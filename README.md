# Playwright CLI SDK Packaging

This repository builds prebuilt `playwright-cli` SDK archives for bodchat-codex.

The package output is a `.tar.gz` archive containing:

- a `playwright-cli` wrapper command
- a bundled Node runtime
- vendored Playwright CLI dependencies
- preinstalled Playwright browser assets
- SDK-installable Playwright CLI skill files
- package and release manifests

## Local Build

```sh
npm ci
npm run build -- --target darwin-arm64 --profile chromium-full --package-version 20260619.1
```

Supported targets:

- `linux-x64`
- `linux-arm64`
- `darwin-arm64`

Supported profiles:

- `chromium-full`
- `all-browsers`

Build output is written to `dist/`.

`manifest.json` is included inside each archive. The final archive checksum is
written to `dist/*.tar.gz.sha256`, `dist/*.tar.gz.manifest.json`, and the
aggregate `release-manifest.json`, because a tarball cannot truthfully contain
its own final checksum inside one of its archived files.

## GitHub Actions

Use the `Build Playwright CLI SDK` workflow from the GitHub Actions page. The
manual workflow builds every target/profile matrix entry and uploads the
archives as workflow artifacts.

Set `publish_release` to `true` to create a GitHub Release containing all
archives and an aggregate `release-manifest.json`.
