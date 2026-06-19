import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  getContext,
  readJson,
  requiredBrowserPrefixes,
  writeJson
} from './common.mjs';

const ctx = getContext();
const lock = await readJson(ctx.lockPath);
const verification = await readJson(ctx.verificationPath);
const browsersJson = JSON.parse(await readFile(join(ctx.packageRoot, 'node_modules', 'playwright-core', 'browsers.json'), 'utf8'));
const installedDirs = await readdir(join(ctx.packageRoot, 'ms-playwright'));

function directoryPrefixForBrowserName(name) {
  return `${name.replaceAll('-', '_')}-`;
}

function browserEntry(browser) {
  const prefix = directoryPrefixForBrowserName(browser.name);
  const dir = installedDirs.find((name) => name.startsWith(prefix));
  if (!dir) {
    return null;
  }
  return {
    name: browser.name,
    revision: String(browser.revision),
    ...(browser.browserVersion ? { browser_version: browser.browserVersion } : {}),
    path: `ms-playwright/${dir}`
  };
}

const requiredPrefixes = requiredBrowserPrefixes(ctx.profile);
const browserEntries = browsersJson.browsers
  .map(browserEntry)
  .filter(Boolean)
  .filter((entry) => requiredPrefixes.some((prefix) => entry.path.slice('ms-playwright/'.length).startsWith(prefix)));

const manifest = {
  schema_version: 1,
  sdk_type: 'playwright-cli',
  package_version: ctx.packageVersion,
  profile: ctx.profile,
  target: ctx.target,
  created_at: lock.created_at,
  archive: {
    name: ctx.archiveName,
    sha256: null,
    size_bytes: null
  },
  commands: {
    playwright_cli: 'bin/playwright-cli',
    playwright: 'bin/playwright',
    playwright_libexec: 'libexec/playwright'
  },
  env: [
    'PLAYWRIGHT_BROWSERS_PATH={root}/ms-playwright',
    'PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1',
    'PLAYWRIGHT_SKIP_BROWSER_GC=1'
  ],
  paths: [
    'bin'
  ],
  install_skills: [
    'skills/playwright-cli'
  ],
  dependencies: {
    node: {
      version: lock.node.version,
      source: lock.node.source
    },
    npm: lock.npm,
    playwright_cli: {
      package: '@playwright/cli',
      version: lock.packages['@playwright/cli']
    },
    playwright: {
      package: 'playwright',
      version: lock.packages.playwright
    },
    playwright_core: {
      package: 'playwright-core',
      version: lock.packages['playwright-core']
    }
  },
  browsers: browserEntries,
  verification
};

await writeJson(join(ctx.packageRoot, 'manifest.json'), manifest);
console.log('Wrote package manifest');
