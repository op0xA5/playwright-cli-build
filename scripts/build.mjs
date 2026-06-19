import { getContext, run } from './common.mjs';

const ctx = getContext();
const commonArgs = [
  '--target', ctx.target,
  '--profile', ctx.profile,
  '--package-version', ctx.packageVersion,
  '--build-dir', ctx.buildDir,
  '--dist-dir', ctx.distDir
];

for (const script of [
  'scripts/resolve-versions.mjs',
  'scripts/download-node.mjs',
  'scripts/install-playwright.mjs',
  'scripts/collect-skills.mjs',
  'scripts/create-wrappers.mjs',
  'scripts/verify-package.mjs',
  'scripts/write-manifest.mjs',
  'scripts/pack.mjs'
]) {
  await run(process.execPath, [script, ...commonArgs]);
}

console.log(`Build completed for ${ctx.profile}/${ctx.target}`);

