import { chmod, copyFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ensureDir, getContext } from './common.mjs';

const ctx = getContext();
const binDir = join(ctx.packageRoot, 'bin');
const libexecDir = join(ctx.packageRoot, 'libexec');
const playwrightCliWrapper = `#!/usr/bin/env sh
set -eu
bin_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
root=$(CDPATH= cd -- "$bin_dir/.." && pwd)
export PLAYWRIGHT_BROWSERS_PATH="$root/ms-playwright"
export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
export PLAYWRIGHT_SKIP_BROWSER_GC=1
exec "$root/node/bin/node" "$root/node_modules/@playwright/cli/playwright-cli.js" "$@"
`;
const playwrightWrapper = `#!/usr/bin/env sh
set -eu
script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
root=$(CDPATH= cd -- "$script_dir/.." && pwd)
export PLAYWRIGHT_BROWSERS_PATH="$root/ms-playwright"
export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
export PLAYWRIGHT_SKIP_BROWSER_GC=1
exec "$root/node/bin/node" "$root/node_modules/playwright/cli.js" "$@"
`;

await ensureDir(binDir);
await ensureDir(libexecDir);

const playwrightCli = join(binDir, 'playwright-cli');
await writeFile(playwrightCli, playwrightCliWrapper, 'utf8');
await chmod(playwrightCli, 0o755);

for (const destination of [join(binDir, 'playwright')]) {
  await copyFile(playwrightCli, destination);
  await chmod(destination, 0o755);
}

const diagnosticPlaywright = join(libexecDir, 'playwright');
await writeFile(diagnosticPlaywright, playwrightWrapper, 'utf8');
await chmod(diagnosticPlaywright, 0o755);

console.log('Created playwright-cli wrappers');
