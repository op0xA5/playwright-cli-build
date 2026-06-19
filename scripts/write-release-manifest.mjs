import { readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { parseArgs, readJson, writeJson } from './common.mjs';

const args = parseArgs();
const distDir = resolve(args['dist-dir'] || process.env.DIST_DIR || 'dist');
const packageVersion = args['package-version'] || process.env.PACKAGE_VERSION;

if (!packageVersion) {
  throw new Error('Missing --package-version or PACKAGE_VERSION');
}

const files = await readdir(distDir);
const sidecars = files
  .filter((name) => name.endsWith('.tar.gz.manifest.json'))
  .sort();

if (sidecars.length === 0) {
  throw new Error(`No package sidecar manifests found in ${distDir}`);
}

const manifests = await Promise.all(sidecars.map((name) => readJson(join(distDir, name))));
const createdAt = manifests.map((manifest) => manifest.created_at).sort()[0];

const releaseManifest = {
  schema_version: 1,
  sdk_type: 'playwright-cli',
  package_version: packageVersion,
  created_at: createdAt,
  items: manifests
    .map((manifest) => ({
      profile: manifest.profile,
      target: manifest.target,
      archive: manifest.archive.name,
      sha256: manifest.archive.sha256,
      size_bytes: manifest.archive.size_bytes
    }))
    .sort((a, b) => `${a.profile}:${a.target}`.localeCompare(`${b.profile}:${b.target}`))
};

await writeJson(join(distDir, 'release-manifest.json'), releaseManifest);
console.log(`Wrote release manifest with ${releaseManifest.items.length} item(s)`);

