import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import {
  fileExists,
  getContext,
  readJson,
  requiredBrowserPrefixes,
  run,
  writeJson
} from './common.mjs';

const ctx = getContext();
const lock = await readJson(ctx.lockPath);
const verification = {
  playwright_cli_version_output: null,
  playwright_version_output: null,
  node_version_output: null,
  playwright_help: 'not-run',
  dependency_dry_run: null,
  headless_chromium_smoke_test: 'not-run',
  firefox_smoke_test: 'not-run',
  webkit_smoke_test: 'not-run'
};

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function assertExists(path) {
  assert(await fileExists(path), `Missing required path: ${path}`);
}

await assertExists(join(ctx.packageRoot, 'bin', 'playwright-cli'));
await assertExists(join(ctx.packageRoot, 'bin', 'playwright'));
await assertExists(join(ctx.packageRoot, 'libexec', 'playwright'));
await assertExists(join(ctx.packageRoot, 'node', 'bin', 'node'));
await assertExists(join(ctx.packageRoot, 'node_modules', '@playwright', 'cli', 'playwright-cli.js'));
await assertExists(join(ctx.packageRoot, 'node_modules', 'playwright-core', 'browsers.json'));
await assertExists(join(ctx.packageRoot, 'skills', 'playwright-cli', 'SKILL.md'));

for (const forbidden of ['node', 'npm', 'npx']) {
  assert(!(await fileExists(join(ctx.packageRoot, 'bin', forbidden))), `Forbidden executable exists: bin/${forbidden}`);
}

const browserDirs = await readdir(join(ctx.packageRoot, 'ms-playwright'));
for (const prefix of requiredBrowserPrefixes(ctx.profile)) {
  assert(
    browserDirs.some((name) => name.startsWith(prefix)),
    `Missing browser asset directory with prefix ${prefix}`
  );
}

const env = {
  PLAYWRIGHT_BROWSERS_PATH: join(ctx.packageRoot, 'ms-playwright'),
  PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: '1',
  PLAYWRIGHT_SKIP_BROWSER_GC: '1'
};

verification.playwright_cli_version_output = (await run(join(ctx.packageRoot, 'bin', 'playwright-cli'), ['--version'], {
  capture: true,
  env
})).stdout.trim();
verification.playwright_version_output = (await run(join(ctx.packageRoot, 'libexec', 'playwright'), ['--version'], {
  capture: true,
  env
})).stdout.trim();
verification.node_version_output = (await run(join(ctx.packageRoot, 'node', 'bin', 'node'), ['--version'], {
  capture: true
})).stdout.trim();
assert(
  verification.node_version_output === lock.node.version,
  `Runtime Node version mismatch: ${verification.node_version_output} !== ${lock.node.version}`
);

await run(join(ctx.packageRoot, 'bin', 'playwright-cli'), ['--help'], {
  capture: true,
  env
});
verification.playwright_help = 'passed';

if (ctx.target.startsWith('linux-')) {
  const args = ctx.profile === 'chromium-full'
    ? ['install-deps', '--dry-run', 'chromium']
    : ['install-deps', '--dry-run'];
  const result = await run(join(ctx.packageRoot, 'bin', 'playwright-cli'), args, {
    capture: true,
    env
  });
  verification.dependency_dry_run = `${result.stdout}${result.stderr}`.trim();
}

async function browserSmoke(browserName, required) {
  const code = `
const { ${browserName} } = require(${JSON.stringify(join(ctx.packageRoot, 'node_modules', 'playwright'))});
(async () => {
  const browser = await ${browserName}.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('about:blank');
  if (page.url() !== 'about:blank') throw new Error('Unexpected page URL: ' + page.url());
  await browser.close();
})().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
`;
  try {
    await run(join(ctx.packageRoot, 'node', 'bin', 'node'), ['-e', code], {
      capture: true,
      env
    });
    return 'passed';
  } catch (error) {
    if (required) {
      throw error;
    }
    return `skipped: ${String(error.stderr || error.message).split('\n')[0]}`;
  }
}

verification.headless_chromium_smoke_test = await browserSmoke('chromium', true);
if (ctx.profile === 'all-browsers') {
  verification.firefox_smoke_test = await browserSmoke('firefox', false);
  verification.webkit_smoke_test = await browserSmoke('webkit', false);
}

await writeJson(ctx.verificationPath, verification);
console.log('Package verification passed');

