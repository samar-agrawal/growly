const { Client } = require('pg');
const { randomUUID } = require('node:crypto');

// Integration and browser tests share a database, but never application tables.
async function createTestDatabase() {
  if (!process.env.TEST_DATABASE_URL) {
    throw new Error(
      'TEST_DATABASE_URL is required; use a PostgreSQL test database with CREATE SCHEMA permission.',
    );
  }
  const admin = new Client({ connectionString: process.env.TEST_DATABASE_URL });
  await admin.connect();
  const schema = `growly_test_${randomUUID().replaceAll('-', '')}`;
  try {
    await admin.query(`CREATE SCHEMA ${schema}`);
  } catch (error) {
    await admin.end();
    throw error;
  }
  const url = new URL(process.env.TEST_DATABASE_URL);
  url.searchParams.set(
    'options',
    `${url.searchParams.get('options') || ''} -c search_path=${schema}`.trim(),
  );
  return {
    url: url.toString(),
    async close() {
      try {
        await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      } finally {
        await admin.end();
      }
    },
  };
}
module.exports = { createTestDatabase };
