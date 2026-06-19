import * as tar from 'tar';
import { join } from 'node:path';
import { readdir } from 'node:fs/promises';
import { ensureDir, fileSize, getContext, readJson, sha256File, writeJson } from './common.mjs';

const ctx = getContext();
const archivePath = join(ctx.distDir, ctx.archiveName);
const sidecarManifestPath = join(ctx.distDir, `${ctx.archiveName}.manifest.json`);
const shaPath = join(ctx.distDir, `${ctx.archiveName}.sha256`);
const excludedEntries = new Set([
  'package.json',
  'package-lock.json',
  'node_modules/.package-lock.json'
]);

await ensureDir(ctx.distDir);
const archiveEntries = (await readdir(ctx.packageRoot))
  .filter((entry) => !excludedEntries.has(entry))
  .sort();

await tar.c({
  cwd: ctx.packageRoot,
  file: archivePath,
  gzip: { level: 9 },
  portable: true,
  filter: (path) => !excludedEntries.has(path),
  noMtime: true,
  mtime: new Date(0)
}, archiveEntries);

const sha256 = await sha256File(archivePath);
const sizeBytes = await fileSize(archivePath);
const manifest = await readJson(join(ctx.packageRoot, 'manifest.json'));
manifest.archive.sha256 = sha256;
manifest.archive.size_bytes = sizeBytes;

await writeJson(sidecarManifestPath, manifest);
await writeJson(join(ctx.buildDir, 'archive-info.json'), {
  profile: ctx.profile,
  target: ctx.target,
  archive: ctx.archiveName,
  sha256,
  size_bytes: sizeBytes
});
await import('node:fs/promises').then(({ writeFile }) => writeFile(shaPath, `${sha256}  ${ctx.archiveName}\n`, 'utf8'));

console.log(`Packed ${ctx.archiveName}`);
console.log(`sha256 ${sha256}`);
