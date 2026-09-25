import { spawn } from 'node:child_process';
import testing from '../backend/testing/database.js';
const database = await testing.createTestDatabase();
const children = [
  spawn(process.execPath, ['backend/server.js'], {
    stdio: 'inherit',
    env: {
      ...process.env,
      DATABASE_URL: database.url,
      PORT: '4108',
    },
  }),
  spawn(
    process.execPath,
    ['frontend/node_modules/next/dist/bin/next', 'dev', 'frontend', '-p', '3108'],
    {
      stdio: 'inherit',
      env: { ...process.env, INTERNAL_API_URL: 'http://127.0.0.1:4108' },
    },
  ),
];
let stopping = false;
async function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  await Promise.all(
    children.map(
      (child) =>
        new Promise((resolve) => {
          if (child.exitCode !== null) return resolve();
          child.once('exit', resolve);
          child.kill('SIGTERM');
        }),
    ),
  );
  await database.close();
  process.exit(code);
}
process.once('SIGTERM', () => stop());
process.once('SIGINT', () => stop());
for (const child of children)
  child.once('exit', (code) => {
    if (!stopping) stop(code || 1);
  });
