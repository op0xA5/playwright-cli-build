import { cleanPath, ensureDir, getContext, run, writeJson } from './common.mjs';

const ctx = getContext();

async function npmView(spec, field = 'version') {
  const fields = Array.isArray(field) ? field : [field];
  const result = await run('npm', ['view', spec, ...fields, '--json'], { capture: true });
  const value = JSON.parse(result.stdout);
  if (Array.isArray(value)) {
    return value.at(-1);
  }
  return value;
}

async function findNodeRuntime(targetInfo) {
  const response = await fetch('https://nodejs.org/dist/index.json');
  if (!response.ok) {
    throw new Error(`Unable to fetch Node release index: ${response.status} ${response.statusText}`);
  }
  const releases = await response.json();
  const release = releases.find((item) => Array.isArray(item.files) && item.files.includes(targetInfo.nodeIndexFile));
  if (!release) {
    throw new Error(`No Node release found for ${targetInfo.nodeIndexFile}`);
  }

  const baseName = `node-${release.version}-${targetInfo.nodeArchiveKey}`;
  for (const extension of ['tar.xz', 'tar.gz']) {
    const url = `https://nodejs.org/dist/${release.version}/${baseName}.${extension}`;
    const head = await fetch(url, { method: 'HEAD' });
    if (head.ok) {
      return {
        version: release.version,
        node_index_file: targetInfo.nodeIndexFile,
        node_archive_key: targetInfo.nodeArchiveKey,
        archive_basename: `${baseName}.${extension}`,
        download_url: url,
        source: 'nodejs.org official binary archive'
      };
    }
  }

  throw new Error(`No downloadable Node archive found for ${baseName}`);
}

await cleanPath(ctx.buildDir);
await ensureDir(ctx.buildDir);
await ensureDir(ctx.distDir);

const node = await findNodeRuntime(ctx.targetInfo);
const npmVersion = (await run('npm', ['--version'], { capture: true })).stdout.trim();
const playwrightCliMeta = await npmView('@playwright/cli@latest', ['version', 'dependencies']);
const playwrightCliVersion = playwrightCliMeta.version;
const playwrightSpec = playwrightCliMeta.dependencies?.playwright || 'latest';
const playwrightCoreSpec = playwrightCliMeta.dependencies?.['playwright-core'] || playwrightSpec;
const playwrightVersion = await npmView(`playwright@${playwrightSpec}`);
const playwrightCoreVersion = await npmView(`playwright-core@${playwrightCoreSpec}`);

const lock = {
  schema_version: 1,
  sdk_type: 'playwright-cli',
  package_version: ctx.packageVersion,
  profile: ctx.profile,
  target: ctx.target,
  created_at: new Date().toISOString(),
  node,
  npm: {
    used_for_build: true,
    included_in_package: false,
    version: npmVersion
  },
  packages: {
    '@playwright/cli': playwrightCliVersion,
    playwright: playwrightVersion,
    'playwright-core': playwrightCoreVersion
  },
  package_specs: {
    playwright: playwrightSpec,
    'playwright-core': playwrightCoreSpec
  }
};

await writeJson(ctx.lockPath, lock);
console.log(`Resolved Node ${node.version} and Playwright ${playwrightCliVersion}`);
