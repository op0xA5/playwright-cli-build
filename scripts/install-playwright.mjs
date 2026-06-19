import { join } from 'node:path';
import {
  cleanPath,
  ensureDir,
  getContext,
  installBrowserArgs,
  readJson,
  run
} from './common.mjs';

const ctx = getContext();
const lock = await readJson(ctx.lockPath);

await ensureDir(ctx.packageRoot);
await ensureDir(join(ctx.packageRoot, 'ms-playwright'));

await run('npm', [
  'install',
  '--prefix',
  ctx.packageRoot,
  '--omit=dev',
  '--no-audit',
  '--no-fund',
  `@playwright/cli@${lock.packages['@playwright/cli']}`,
  `playwright@${lock.packages.playwright}`,
  `playwright-core@${lock.packages['playwright-core']}`
], {
  env: {
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: '1'
  }
});

const cliScript = join(ctx.packageRoot, 'node_modules', '@playwright', 'cli', 'playwright-cli.js');
await run(process.execPath, [cliScript, ...installBrowserArgs(ctx.profile)], {
  cwd: ctx.packageRoot,
  env: {
    PLAYWRIGHT_BROWSERS_PATH: join(ctx.packageRoot, 'ms-playwright'),
    PLAYWRIGHT_SKIP_BROWSER_GC: '1'
  }
});

await Promise.all([
  cleanPath(join(ctx.packageRoot, 'package.json')),
  cleanPath(join(ctx.packageRoot, 'package-lock.json')),
  cleanPath(join(ctx.packageRoot, 'node_modules', '.package-lock.json'))
]);

console.log(`Installed Playwright profile ${ctx.profile}`);
