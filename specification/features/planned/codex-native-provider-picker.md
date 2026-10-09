# Feature: Codex Native Provider Picker

## Outcome and constraints

The native desktop model picker should select both the model and its provider.
OpenAI remains the default and uses Codex's native subscription provider. Claude
uses the authenticated local Harness gateway and the existing Claude Code login.
Keep the same thread and history; do not extract subscription tokens, add a paid
fallback, or route native OpenAI through a replacement gateway.

## Acceptance Criteria

- The installed native picker offers OpenAI models and Claude Opus 5.5.
- Selecting Claude sends inference to the local gateway; selecting OpenAI restores
  the native subscription route. Catalog labels alone do not satisfy routing.
- Provider changes wait for an idle chat closed on all clients, then reopen that
  same thread, verify provider/model/effort, and restore prior settings on failure.
- Verify streaming, a Codex-executed tool, follow-up history, and a desktop
  Claude/OpenAI/Claude round trip before proceeding with dependent integration.
- Keep generated evidence untracked and leave existing services and defaults intact.

## Installed-client feasibility result (2026-10-09)

The routing gate is blocked in desktop-bundled Codex `0.162.0-alpha.2`. Inspection
of the installed desktop assets shows that native model selection writes `model`
and `model_reasoning_effort`. It does not select `model_provider`. The app-server
model catalog has no provider field; active-thread settings and turn settings
also have no supported provider update field. Start/resume requests can specify
the provider, which is a separate operation from native model selection.

Two isolated probes used the installed binary, synthetic credentials and local
fixtures without changing the user's configuration or making paid requests:

1. With the native `openai` provider, an explicit mixed catalog returned both
   GPT-6.1 Sol and Opus. Selecting Opus changed the model while leaving the thread
   provider `openai`. Sending `modelProvider` to `thread/settings/update` returned
   an empty success result but did not change the provider. No inference was run.
2. With two local provider endpoints, Opus selection sent the Responses request
   to the previously selected endpoint. Catalog `model_provider`/`modelProvider`
   hints were ignored. A control thread explicitly started with `harness-claude`
   sent the request to the Claude fixture, proving the fixture routing worked.

Both acceptance probes exit 1 for the unresolved routing requirement. Evidence:
`.cache/codex-picker-evidence/native-routing-probe/{native-result,result}.json`
and `client-evidence.json`; the reproducible probe is
`.cache/codex-picker-evidence/native-routing-probe.ts`. These are ignored artifacts.

No native picker change is installed. OpenAI remains GPT-6.1 Sol at max effort;
the global model catalog and provider remain unchanged. Existing plugin requests
remain pending. Desktop UI screenshots and the provider round trip are unverified;
native-app computer-use access was previously denied and was not bypassed.
Stop dependent integration at this gate. A provider-aware desktop picker/control
extension is required before this configuration can deliver the requested behavior.

## References

- [Gateway configuration](https://learn.chatgpt.com/docs/enterprise/connect-to-a-gateway)
- [Model discovery](https://learn.chatgpt.com/docs/app-server#list-models-modellist)
- [Plugin extensions](https://developers.openai.com/plugins/build/extensions)
