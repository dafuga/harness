# Local provider sign-in

The Harness CLI provides one entry point for opening the installed ChatGPT, Claude and Gemini sign-in tools on the current computer. The Harbor desktop host can use the same command while keeping the provider session in the operator's terminal.

## Acceptance criteria

- `harness provider status <provider> --json` reports the fixed executable name and whether it is installed.
- `harness provider sign-in <provider>` opens the official CLI with its fixed interactive arguments and reports its exit status.
- The provider process starts in the operator's home directory with the local terminal inherited and a restricted environment.
- An unknown or unavailable provider starts no process. Machine output contains no credentials, account data or private paths.
