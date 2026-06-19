import { basename, join } from 'node:path';
import { cp, readdir } from 'node:fs/promises';
import {
  cleanPath,
  downloadFile,
  ensureDir,
  getContext,
  readJson,
  run
} from './common.mjs';

const ctx = getContext();
const lock = await readJson(ctx.lockPath);
const cacheDir = join(ctx.buildDir, 'cache');
const extractDir = join(ctx.buildDir, 'node-extract');
const archivePath = join(cacheDir, basename(lock.node.download_url));

await ensureDir(cacheDir);
await cleanPath(extractDir);
await ensureDir(extractDir);
await ensureDir(ctx.packageRoot);

await downloadFile(lock.node.download_url, archivePath);
await run('tar', ['-xf', archivePath, '-C', extractDir]);

const extracted = (await readdir(extractDir)).find((name) => name.startsWith('node-'));
if (!extracted) {
  throw new Error(`Unable to find extracted Node directory in ${extractDir}`);
}

const nodeRoot = join(ctx.packageRoot, 'node');
await cleanPath(nodeRoot);
await cp(join(extractDir, extracted), nodeRoot, {
  recursive: true,
  force: true,
  verbatimSymlinks: true
});

await Promise.all([
  cleanPath(join(nodeRoot, 'bin', 'npm')),
  cleanPath(join(nodeRoot, 'bin', 'npx')),
  cleanPath(join(nodeRoot, 'bin', 'corepack')),
  cleanPath(join(nodeRoot, 'lib', 'node_modules', 'npm')),
  cleanPath(join(nodeRoot, 'lib', 'node_modules', 'corepack'))
]);

console.log(`Downloaded runtime Node ${lock.node.version}`);

