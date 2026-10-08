# Feature: Codex Provider Picker

## Authorized delivery slice (2026-10-08)

Daniel accepted building the picker with local verification while desktop installation
and real provider application remain pending. This relaxes the desktop gate only for
this picker slice; quota collection and the full Harness panel remain deferred.

## Acceptance

- Installable local plugin with a conversation-panel entrypoint and MCP stdio tools.
- Explicit session binding; never guess native thread identity from plugin instance IDs.
- Discover OpenAI models from the local Codex cache and Claude from its opt-in catalog.
  Catalog availability is not a promise of live quota or entitlement.
- Keep active observation separate from pending selection, including unknown state.
- Persist requests per session, deduplicate delivery, allow explicit cancellation.
- Never edit Codex defaults or authenticate/route native OpenAI through Claude.
- Requests remain pending without verified desktop control. Only an internal verified
  control adapter may cold-resume an idle thread with zero connected clients and confirm
  provider, model and effort before reporting applied; failed application rolls back.
- Local preview uses isolated synthetic sessions, not real desktop conversations.
- Red/green unit, MCP and browser regressions; inspected screenshots and full checks.
- Desktop panel, provider round trip, phone and voice proof remain explicitly pending.

## Local verification and installation

The full repository check and unchanged browser/MCP regressions passed. The bundled
plugin was installed into the user Codex plugin cache through the installed app's
CLI; HTML/server/manifest hashes match the verified build. The native default remains
gpt-6.1-sol with high effort. Codex desktop rendering and real model application are
still unverified. The local preview accepts only its synthetic preview-session.

The local delivery loop is complete for this bounded slice. Its generated trace,
screenshots and logs remain untracked; the original gateway desktop gate stays pending.
