# Claude & OpenAI picker (local preview delivery)

This plugin provides a model picker conversation-panel entrypoint and six local MCP tools:
open_model_picker, get_provider_status, list_models, list_observed_sessions,
request_model_switch and cancel_model_switch.

**A queued selection does not switch your desktop model yet.** The public control
connection to the installed desktop app is unavailable. Active settings show unknown;
requests stay pending. No desktop adapter, automatic resume, fallback or global configuration
write is included. The native OpenAI default remains unchanged.

The separately installed **Codex Harness Experimental** app now has a working
native Claude picker. Use that app's native model control to apply a provider
change; this plugin's queue remains independent and pending. See
[native setup and desktop proof](../../specification/features/planned/codex-native-provider-picker.md).

## Build and manual installation

Requirements: Bun >= 1.2, this Harness checkout with dependencies installed, and
Codex supporting local marketplace plugins. Claude inference separately requires the
existing Claude Code Max login and the previously configured opt-in gateway/catalog.

From the Harness repository root:

```sh
bun install
bun run build:picker
codex plugin marketplace add .
codex plugin add claude-picker@harness-local
```

Restart the desktop app yourself when convenient, then open a fresh conversation.
If supported, open **Model picker** from its conversation panels. Choose a provider,
model and effort, then **Queue switch**. Bind an explicit native Codex session ID if
the entrypoint did not receive one. Never use an unrelated ChatGPT/plugin conversation ID.
Opening the panel with a known session through open_model_picker also binds it.
The plugin does not guess identities or discover every native conversation.

Catalogs are read from ~/.codex/models_cache.json and
~/.codex/harness-gateway/claude-models.json (or CODEX_HOME). Missing/invalid catalogs
yield no models. Labels come from local catalogs, not a live entitlement or quota check.
Subscription quota is not implemented in this slice.

Requests persist in ~/.codex/harness/picker/provider-switches.sqlite with owner-only
permissions; HARNESS_PICKER_HOME can select an isolated directory. They contain only
session IDs, model selections, timestamps and status; no prompts or subscription tokens.
The MCP transport is a local process pipe, with no network listener.

## Trust and reversal

This plugin contains **no lifecycle hooks** and needs no hook-trust approval.
Future Harness/Claude hooks must be reviewed and explicitly trusted through Codex before
running; installation alone must never be described as trusting hooks.

To remove the plugin, run codex plugin remove claude-picker@harness-local.
If no other plugins use this marketplace, codex plugin marketplace remove harness-local
removes its registration. Keep or manually remove the picker queue directory as desired.
Neither operation changes the gateway LaunchAgent, subscription login or OpenAI defaults.

## Verification boundary

The bundled HTML, MCP protocol, durable queue and isolated local browser preview are
tested. Native desktop rendering/application, all-device closure, phone reconnection and
voice remain pending. Do not present the local preview as installed desktop proof.
Publication and public hosting are outside this delivery.
