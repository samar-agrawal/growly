const fs = require('node:fs');
const path = require('node:path');

// Rebuild the old tables atomically: IDs, links, timestamps, notes, and durations
// are copied unchanged. The removed session type does not reclassify history.
async function migrateDatabase({ execSql, runSql, allSql, dbPath }) {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  const tables = await allSql("SELECT name FROM sqlite_master WHERE type = 'table'");
  const legacy = tables.some(table => table.name === 'categories');
  if (!legacy) {
    const columns = await allSql('PRAGMA table_info(settings)');
    if (columns.some(column => column.name === 'timezone')) {
      const backupPath = `${dbPath}.before-remove-timezone-${Date.now()}.bak`;
      await runSql('VACUUM INTO ?', [backupPath]);
      await execSql('BEGIN IMMEDIATE;');
      try {
        await execSql(`
          ALTER TABLE settings RENAME TO settings_with_timezone;
          ${schema}
          INSERT INTO settings (id_setting, weekly_commitment_minutes, weekly_buffer_minutes, weekly_revision_minutes, week_start_day, notification_preferences)
            SELECT id_setting, weekly_commitment_minutes, weekly_buffer_minutes, weekly_revision_minutes, week_start_day, notification_preferences FROM settings_with_timezone;
          DROP TABLE settings_with_timezone;
          COMMIT;
        `);
      } catch (error) {
        await execSql('ROLLBACK;');
        throw error;
      }
      console.log(`Timezone removed. Previous database saved to ${backupPath}`);
    } else {
      await execSql(schema);
    }
    return;
  }
  // SQLite's own snapshot includes committed WAL contents as well as the main file.
  const backupPath = `${dbPath}.before-focus-areas-${Date.now()}.bak`;
  await runSql('VACUUM INTO ?', [backupPath]);
  await execSql('PRAGMA foreign_keys = OFF; BEGIN IMMEDIATE;');
  try {
    const updated = async table => {
      const columns = await allSql(`PRAGMA table_info(${table})`);
      return columns.some(column => column.name === 'updated_at')
        ? "COALESCE(updated_at, strftime('%Y-%m-%dT%H:%M:%fZ', created_at))"
        : "strftime('%Y-%m-%dT%H:%M:%fZ', created_at)";
    };
    const areaUpdated = await updated('categories');
    const subtopicUpdated = await updated('topics');
    await execSql(`
      DROP TRIGGER IF EXISTS category_delete_history;
      DROP TRIGGER IF EXISTS topic_delete_history;
      DROP TRIGGER IF EXISTS topic_update_history;
      ALTER TABLE settings RENAME TO legacy_settings;
      ALTER TABLE categories RENAME TO legacy_categories;
      ALTER TABLE topics RENAME TO legacy_topics;
      ALTER TABLE sessions RENAME TO legacy_sessions;
      ${schema}
      INSERT INTO settings SELECT id, weekly_commitment_minutes, weekly_buffer_minutes, 0, week_start_day, notification_preferences FROM legacy_settings;
      INSERT INTO focus_areas SELECT id, name, description, curriculum_enabled, archived_at, ${areaUpdated}, created_at FROM legacy_categories;
      INSERT INTO subtopics SELECT id, category_id, name, status, completed_at, ${subtopicUpdated}, notes, created_at FROM legacy_topics;
      INSERT INTO sessions SELECT id, category_id, topic_id, topic_name, date, duration_minutes, outcome, notes, created_at FROM legacy_sessions;
      DROP TABLE legacy_sessions;
      DROP TABLE legacy_topics;
      DROP TABLE legacy_categories;
      DROP TABLE legacy_settings;
      COMMIT;
    `);
  } catch (error) {
    await execSql('ROLLBACK;');
    throw error;
  }
  console.log(`Database migrated. Previous database saved to ${backupPath}`);
}

module.exports = { migrateDatabase };

async function migrateFile(dbPath) {
  const sqlite3 = require('sqlite3');
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new sqlite3.Database(dbPath);
  db.configure('busyTimeout', 5000);
  const execSql = sql => new Promise((resolve, reject) => db.exec(sql, error => error ? reject(error) : resolve()));
  const runSql = (sql, params = []) => new Promise((resolve, reject) => db.run(sql, params, error => error ? reject(error) : resolve()));
  const allSql = (sql, params = []) => new Promise((resolve, reject) => db.all(sql, params, (error, rows) => error ? reject(error) : resolve(rows)));
  try { await migrateDatabase({ execSql, runSql, allSql, dbPath }); }
  finally { await new Promise((resolve, reject) => db.close(error => error ? reject(error) : resolve())); }
}
module.exports.migrateFile = migrateFile;

if (require.main === module) {
  const dbPath = path.join(process.env.GROWLY_DATA_DIR || path.join(__dirname, 'data'), 'growly.db');
  migrateFile(dbPath).then(() => console.log('Database schema is up to date.')).catch(error => {
    console.error('Database migration failed:', error);
    process.exitCode = 1;
  });
}
