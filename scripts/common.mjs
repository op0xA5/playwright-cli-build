import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';

export const PROFILES = new Set(['chromium-full', 'all-browsers']);
export const TARGETS = new Map([
  ['linux-x64', {
    nodeIndexFile: 'linux-x64',
    nodeArchiveKey: 'linux-x64',
    runner: 'ubuntu-latest'
  }],
  ['linux-arm64', {
    nodeIndexFile: 'linux-arm64',
    nodeArchiveKey: 'linux-arm64',
    runner: 'ubuntu-24.04-arm'
  }],
  ['darwin-arm64', {
    nodeIndexFile: 'osx-arm64-tar',
    nodeArchiveKey: 'darwin-arm64',
    runner: 'macos-latest'
  }]
]);

export function parseArgs(argv = process.argv.slice(2)) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const item = argv[i];
    if (!item.startsWith('--')) {
      throw new Error(`Unexpected positional argument: ${item}`);
    }
    const eq = item.indexOf('=');
    if (eq !== -1) {
      args[item.slice(2, eq)] = item.slice(eq + 1);
      continue;
    }
    const key = item.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      args[key] = 'true';
      continue;
    }
    args[key] = next;
    i += 1;
  }
  return args;
}

export function defaultPackageVersion() {
  const now = new Date();
  const ymd = now.toISOString().slice(0, 10).replaceAll('-', '');
  return `${ymd}.${process.env.GITHUB_RUN_NUMBER || '1'}`;
}

export function getContext() {
  const args = parseArgs();
  const target = args.target || process.env.TARGET;
  const profile = args.profile || process.env.PROFILE;
  const packageVersion = args['package-version'] || process.env.PACKAGE_VERSION || defaultPackageVersion();

  if (!TARGETS.has(target)) {
    throw new Error(`Invalid target "${target}". Use one of: ${[...TARGETS.keys()].join(', ')}`);
  }
  if (!PROFILES.has(profile)) {
    throw new Error(`Invalid profile "${profile}". Use one of: ${[...PROFILES.keys()].join(', ')}`);
  }
  if (!/^\d{8}\.\d+$/.test(packageVersion)) {
    throw new Error(`Invalid package version "${packageVersion}". Expected YYYYMMDD.N`);
  }

  const repoRoot = resolve(process.cwd());
  const packageName = `playwright-cli-sdk-${packageVersion}-${profile}-${target}`;
  const buildDir = resolve(args['build-dir'] || process.env.BUILD_DIR || join(repoRoot, 'build', `${profile}-${target}`));
  const packageRoot = join(buildDir, packageName);
  const distDir = resolve(args['dist-dir'] || process.env.DIST_DIR || join(repoRoot, 'dist'));
  const lockPath = join(buildDir, 'build-lock.json');
  const verificationPath = join(buildDir, 'verification.json');
  const targetInfo = TARGETS.get(target);

  return {
    repoRoot,
    target,
    profile,
    packageVersion,
    packageName,
    buildDir,
    packageRoot,
    distDir,
    lockPath,
    verificationPath,
    targetInfo,
    archiveName: `${packageName}.tar.gz`
  };
}

export async function ensureDir(path) {
  await mkdir(path, { recursive: true });
}

export async function cleanPath(path) {
  await rm(path, { recursive: true, force: true });
}

export async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

export async function writeJson(path, value) {
  await ensureDir(dirname(path));
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export function run(command, args = [], options = {}) {
  const printable = [command, ...args].map((part) => {
    if (/^[A-Za-z0-9_./:=@-]+$/.test(part)) {
      return part;
    }
    return JSON.stringify(part);
  }).join(' ');

  return new Promise((resolveRun, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd || process.cwd(),
      env: { ...process.env, ...(options.env || {}) },
      stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit'
    });
    let stdout = '';
    let stderr = '';
    if (options.capture) {
      child.stdout.on('data', (chunk) => {
        stdout += chunk;
      });
      child.stderr.on('data', (chunk) => {
        stderr += chunk;
      });
    }
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolveRun({ stdout, stderr, code });
        return;
      }
      const error = new Error(`Command failed (${code}): ${printable}`);
      error.stdout = stdout;
      error.stderr = stderr;
      error.code = code;
      reject(error);
    });
  });
}

export async function fileExists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

export async function sha256File(path) {
  const hash = createHash('sha256');
  const file = await import('node:fs').then((fs) => fs.createReadStream(path));
  await pipeline(file, hash);
  return hash.digest('hex');
}

export async function fileSize(path) {
  return (await stat(path)).size;
}

export async function downloadFile(url, destination) {
  await ensureDir(dirname(destination));
  const response = await fetch(url);
  if (!response.ok || !response.body) {
    throw new Error(`Download failed ${response.status} ${response.statusText}: ${url}`);
  }
  await pipeline(Readable.fromWeb(response.body), createWriteStream(destination));
}

export function requiredBrowserPrefixes(profile) {
  if (profile === 'chromium-full') {
    return ['chromium-', 'chromium_headless_shell-', 'ffmpeg-'];
  }
  return ['chromium-', 'chromium_headless_shell-', 'firefox-', 'webkit-', 'ffmpeg-'];
}

export function installBrowserArgs(profile) {
  if (profile === 'chromium-full') {
    return ['install', 'chromium'];
  }
  return ['install'];
}
