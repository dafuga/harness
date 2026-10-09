# Feature: Codex Native Provider Picker

## Outcome and constraints

The experimental native desktop picker selects both model and provider. OpenAI
remains the default and uses Codex's native subscription provider. Claude uses the
authenticated localhost Harness gateway and the existing Claude Code login. The
same chat and history survive provider changes. No subscription tokens are
extracted; there is no paid fallback or automatic provider switching.

## Acceptance criteria

- Offer native OpenAI models and Claude Opus 5.5 in the desktop picker.
- Route Claude inference through the gateway and OpenAI through its native provider.
- Switch only an idle, persisted chat with remote control disabled. Close local
  clients, resume the same thread, verify model/provider/effort, and roll back if
  verification fails. Preserve active or interrupted work.
- Prove streaming, Codex-executed tools, follow-up history and a same-chat
  Claude/OpenAI/Claude desktop round trip before dependent integration.
- Keep generated evidence untracked and preserve the original app and defaults.

## Installed experiment (2026-10-09)

Daniel authorized a separate app copy after the vendor client's provider routing
probe failed. The working copy is installed at
`~/Applications/Codex Harness Experimental.app`, based on desktop `26.1002.52244`
and its bundled Codex `0.162.0-alpha.2`. The original `/Applications/ChatGPT.app`
is unchanged; both strict signatures were verified.

Open the experimental copy, start a chat, click the native model/effort control,
choose **Select model** when the effort popup appears, then choose **Claude Opus
5.5 (Harness)**. Claude uses Extra High effort. Choose an OpenAI model through the
same control to return to the native subscription route. A selection takes effect
when the next turn applies the verified provider transition. An active chat or
connected remote client prevents switching rather than silently using another
provider. The original app's native picker does not gain Claude.

The persistent LaunchAgent serves `http://127.0.0.1:47841/v1` with owner-only token
configuration. It starts at login and remains running while the desktop copy is
closed. New chats after launching the copy use the existing OpenAI default.

## Delivery evidence

The native trial `01a120f2-3287-71b0-99f9-25c4dcc700d9` passed:

- Claude streamed commentary and requested Codex's terminal tool. Codex ran
  `printf 'CLAUDE_TOOL_READY\n'`, exit code 0, and returned the correlated output.
- A follow-up recalled `KIWI_953` without resupplying the marker.
- The native picker switched the same chat to GPT-6.1 Sol, which returned
  `KIWI_953 OPENAI_RETURN_READY`, then back to Claude, which returned
  `KIWI_953 CLAUDE_RETURN_READY`.
- After quitting and relaunching the copy, the chat appeared in Recents, restored
  its Claude selection and history, and Codex ran `printf 'STABLE_GATEWAY_READY\n'`
  through the persistent gateway. Claude retained the marker.

Fresh native screenshots were captured and inspected. Evidence lives in ignored
`.cache/codex-picker-evidence/desktop-copy/`, including `native-roundtrip.json`,
`native-roundtrip-green.png`, red/green regression logs and `verified-check.log`.
`bun run check` passed, including unit/integration coverage, builds and Harness
size audits. Focused regressions cover provider isolation, serialized switching,
rollback, active/interrupted work, failed-turn recovery, catalog discovery,
provider-aware history listing, cold resume and original defaults.

## Implementation and boundaries

`NativePickerBridgeService` wraps local app-server requests. It appends the Claude
catalog entry, binds start/resume to a provider, and cold-resumes provider changes
through `NativePickerSwitchService`. Copy-local preferences avoid writing model
selection over global defaults. Original OpenAI configuration is preserved.

The renderer and startup patch is pinned to exact vendor asset hashes. The
preparation script refuses unknown assets and a running copy. It rebuilds the
ASAR, updates its embedded integrity digest and plist hash, and preserves enabled
ASAR validation. The copy uses an Apple Development signature with hardened
runtime; native modules were signed consistently. No security warning was bypassed.

The launcher isolates Chromium user data in
`~/Library/Application Support/Codex Harness Experimental`. Engine history,
`~/.codex` configuration, subscription login and the native SQLite catalog remain
shared. Desktop startup can rewrite bundled MCP runtime paths in that shared
configuration; those paths were restored to the original app for handoff. Remote
control is disabled ephemerally in the copy; persistent original-device settings
are preserved. Auto-update is disabled for this version-pinned experiment.

Hosted `web_search` is disabled for Claude because the gateway rejects that hosted
tool type. Codex-executed functions remain available. OpenAI keeps its original
web-search setting. Phone reconnection and voice have not been tested in the copy.
The desktop gate does not establish compatibility with every Codex feature.

## Rebuild and reversal

`bun scripts/prepare-desktop-experiment.ts` prepares an existing separate app copy
from the pinned original. It requires Bun, `@electron/asar`, the existing gateway
configuration and catalog, and macOS plist/signing tools. Quit the experimental
copy first. The prepared output must then be signed with a valid local development
identity, including every Mach-O `.node` module and the app, and strict signature
verification must pass before launch. The script does not install a certificate,
weaken validation or modify the original bundle.

To stop using the experiment, quit the copy and open the original app. Keep shared
engine history and credentials. Removing the separate copy and its isolated
Chromium data is optional; removing the gateway is a separate service decision.
A vendor update requires new inspection and acceptance proof before rebuilding.

## References

- [Gateway configuration](https://learn.chatgpt.com/docs/enterprise/connect-to-a-gateway)
- [Model discovery](https://learn.chatgpt.com/docs/app-server#list-models-modellist)
- [Plugin extensions](https://developers.openai.com/plugins/build/extensions)
