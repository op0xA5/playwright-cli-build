import { join } from 'node:path';
import { cp } from 'node:fs/promises';
import { cleanPath, fileExists, getContext } from './common.mjs';

const ctx = getContext();
const source = join(ctx.repoRoot, 'assets', 'skills', 'playwright-cli');
const destination = join(ctx.packageRoot, 'skills', 'playwright-cli');

if (!(await fileExists(join(source, 'SKILL.md')))) {
  throw new Error(`Missing skill source: ${join(source, 'SKILL.md')}`);
}

await cleanPath(destination);
await cp(source, destination, {
  recursive: true,
  force: true,
  verbatimSymlinks: true
});

console.log('Collected Playwright CLI skill');

