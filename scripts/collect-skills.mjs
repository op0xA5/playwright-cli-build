import { join } from 'node:path';
import { cp } from 'node:fs/promises';
import { cleanPath, fileExists, getContext } from './common.mjs';

const ctx = getContext();
const source = join(ctx.packageRoot, 'node_modules', '@playwright', 'cli', 'skills');
const destination = join(ctx.packageRoot, 'skills');

if (!(await fileExists(join(source, 'playwright-cli', 'SKILL.md')))) {
  throw new Error(`Missing skill source: ${join(source, 'playwright-cli', 'SKILL.md')}`);
}

await cleanPath(destination);
await cp(source, destination, {
  recursive: true,
  force: true,
  verbatimSymlinks: true
});

console.log('Collected Playwright CLI skill');
