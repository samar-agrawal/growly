const fs = require('node:fs');
const path = require('node:path');
const { AsyncLocalStorage } = require('node:async_hooks');
const { Pool } = require('pg');

function createDatabase(env = process.env) {
  if (!env.DATABASE_URL)
    throw new Error('DATABASE_URL is required. Configure a PostgreSQL connection.');
  const pool = new Pool({
    connectionString: env.DATABASE_URL,
    max: 5,
    connectionTimeoutMillis: 10000,
  });
  const context = new AsyncLocalStorage();
  const query = (sql, params = []) => (context.getStore() || pool).query(sql, params);
  const database = {
    allSql: async (sql, params) => (await query(sql, params)).rows,
    getSql: async (sql, params) => (await query(sql, params)).rows[0],
    runSql: query,
    async transaction(operation) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        // Serialize changes across processes to prevent duplicate inline areas and timer saves.
        await client.query('SELECT pg_advisory_xact_lock(734829104)');
        const result = await context.run(client, operation);
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
    async initialize() {
      await database.transaction(async () =>
        context.getStore().query(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8')),
      );
    },
    close: () => pool.end(),
  };
  return database;
}
module.exports = { createDatabase };
