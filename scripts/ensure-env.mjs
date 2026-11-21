// Creates the git-ignored environment files from the committed template when they are missing,
// so a fresh clone can run `npm start`, `npm run build` and `npm test` straight away.
// Existing files are never overwritten.
import { copyFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const envDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'environments');
const template = join(envDir, 'environment.example.ts');

for (const name of ['environment.ts', 'environment.development.ts']) {
  const target = join(envDir, name);
  if (!existsSync(target)) {
    copyFileSync(template, target);
    console.log(
      `ensure-env: created src/environments/${name} from environment.example.ts (fill in real values)`,
    );
  }
}
