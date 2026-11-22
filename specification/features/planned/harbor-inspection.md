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

# Harbor inspection through Harness

Harbor’s installed CLI package remains the implementation of chain and agent inspection.
Harness exposes `harness harbor version`, `harness harbor chain info` and `harness harbor agent status`.
The operator supplies the trusted Harbor CLI package entry point through `HARNESS_HARBOR_CLI_PATH`
and can select the installed Node runtime through `HARNESS_HARBOR_NODE_PATH`.

Commands preserve the installed Harbor package’s stdout and exit status for these operations.
Harness invokes Node with literal arguments, a limited runtime environment and a finite deadline.
Chain inspection supports the existing `--url` option and prints JSON. Agent status supports the
existing `--config` option and keeps the Harbor package’s output.
