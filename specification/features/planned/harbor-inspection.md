---
status: planned
shippedIn: null
unitIds:
  - command.projects-sessions-harbor-inspection
  - entry.command-help
  - entry.command-loaders
owner: null
reviewedAt: null
---

# Harbor CLI and SDK through Harness

Harbor’s installed CLI package remains the implementation of chain and agent inspection.
Harness exposes `harness harbor version`, `harness harbor chain info` and `harness harbor agent status`.
The operator supplies the trusted Harbor CLI package entry point through `HARNESS_HARBOR_CLI_PATH`
and can select the installed Node runtime through `HARNESS_HARBOR_NODE_PATH`.

`harness harbor service status [service]` and `harness harbor doctor` expose the
installed Harbor CLI runtime diagnostics as JSON. Service status accepts `--system`
for the system service manager. Doctor accepts `--service`, `--config` and `--strict`.
The existing dispatch case verifies fixed argv and keeps signing and provider credentials
out of the runtime environment.

Commands preserve the installed Harbor package’s stdout and exit status for these operations.
Harness invokes Node with literal arguments, a limited runtime environment and a finite deadline.
Chain inspection supports the existing `--url` option and prints JSON. Agent status supports the
existing `--config` option and keeps the Harbor package’s output.

Harbor app development uses the same Harness executable through the installed SDK:

- `harness harbor templates` lists available Harbor SDK templates.
- `harness harbor scaffold <template> <dir> [id] [name] [--mobile]` creates a project, using the running Harness revision for the project scaffold.
- `harness harbor check [dir]` validates the app bundle.
- `harness harbor pack [dir] [output]` writes a bundle to a new file.
- `harness harbor stage-android <bundle> <dir>` stages a Godot Web bundle for an Android app.

Set `HARNESS_HARBOR_APP_SDK_PATH` to the installed SDK entry for these commands.
The SDK supplies the default bundle path, validates the same bytes and owns the Android asset layout.

`harness harbor publish <project> --commit <sha> --artifact <path> --profile <file>`
uses its own verification command and the installed Harbor App SDK. It returns the
exact canonical export, publisher, chain and capability review with an approval digest.
Adding `--approve <digest>` authorizes that same verified export and configured
testnet target. Set `HARNESS_HARBOR_APP_SDK_PATH` to the trusted SDK's
`bin/harbor-app.mjs` entry. The Harbor SDK owns review, the existing Harbor
wallet and chain checks, and HarborStore upload and install verification.
