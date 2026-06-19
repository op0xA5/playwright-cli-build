# Playwright CLI

Use the `playwright-cli` command when a task needs browser automation through
the SDK-packaged Playwright CLI.

The SDK injects these runtime settings:

- `PLAYWRIGHT_BROWSERS_PATH` points at the package-local `ms-playwright`
  directory.
- `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`
- `PLAYWRIGHT_SKIP_BROWSER_GC=1`

Prefer `playwright-cli` for explicit commands. The SDK also exposes a
`playwright` alias for tools or agents that expect the standard Playwright
command name.

