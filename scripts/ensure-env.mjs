// Runs before `npm start`, `npm run build`, `npm test` and `npm run watch`.
//
// 1. Creates the git-ignored environment files from the committed template when they are missing,
//    so a fresh clone can run straight away. Existing files are never replaced.
// 2. Copies the FIREBASE_* values from `.env` (also git-ignored) into the `firebase` block of both
//    environment files. Angular cannot read `.env` in the browser, so this is the bridge.
//    Only the Firebase WEB config belongs there: it is public by design and ends up in the bundle.
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const envDir = join(root, 'src', 'environments');
const template = join(envDir, 'environment.example.ts');
const targets = ['environment.ts', 'environment.development.ts'];

for (const name of targets) {
  const target = join(envDir, name);
  if (!existsSync(target)) {
    copyFileSync(template, target);
    console.log(
      `ensure-env: created src/environments/${name} from environment.example.ts (fill in real values)`,
    );
  }
}

/** `.env` key → property of `environment.firebase`. */
const FIREBASE_KEYS = {
  FIREBASE_API_KEY: 'apiKey',
  FIREBASE_AUTH_DOMAIN: 'authDomain',
  FIREBASE_PROJECT_ID: 'projectId',
  FIREBASE_STORAGE_BUCKET: 'storageBucket',
  FIREBASE_MESSAGING_SENDER_ID: 'messagingSenderId',
  FIREBASE_APP_ID: 'appId',
};

function readDotEnv(path) {
  const values = {};
  if (!existsSync(path)) {
    return values;
  }
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (match) {
      values[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
    }
  }
  return values;
}

const dotEnv = readDotEnv(join(root, '.env'));
const firebase = Object.entries(FIREBASE_KEYS).filter(([key]) => dotEnv[key]);

if (firebase.length > 0) {
  for (const name of targets) {
    const target = join(envDir, name);
    const before = readFileSync(target, 'utf8');
    let after = before;
    for (const [key, prop] of firebase) {
      const value = dotEnv[key].replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      after = after.replace(new RegExp(`(\\b${prop}:\\s*)(['"\`]).*?\\2`), `$1'${value}'`);
    }
    if (after !== before) {
      writeFileSync(target, after);
      console.log(`ensure-env: copied Firebase settings from .env into src/environments/${name}`);
    }
  }
}
