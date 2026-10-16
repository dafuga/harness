# Feature: Desktop Test Preview Isolation

## Overview

A full check reported three Desktop browser failures that were not defects of the product. The native test still looked for a design right after `Create plan`, where an entity now opens on its Overview. The ordinary browser run took whatever already answered on the development port `5799`, which was another checkout's development server, and tested that checkout's renderer.

The repair is in the test and its configuration only. The native test selects Designs where it means to view a design. An ordinary browser run starts its own preview on a port no development server uses and never takes a server that is already there.

## Acceptance Criteria

- `tests/e2e/native-desktop.spec.ts` keeps its one case and its 22 assertions; it gains only the selection of the Designs section after `Create plan`, before the draft capture and the placeholder assertion.
- Outside a verification, `playwright.config.ts` starts the normal `dev` script on `127.0.0.1:5796` and does not reuse a server. Something already answering there ends the run before any test, with the port named.
- `HARNESS_DESKTOP_TEST_PORT` names another port. A value that is not a whole port from 1024 to 65535 is refused by name; nothing falls back to a default.
- Under `HARNESS_VERIFY=1` the configuration resolves to exactly what it did: the static server of the built renderer on `5797`, not reused. The override is not read there.
- `test/test-preview-refusal.test.ts` runs the real configuration against a server of its own: no browser reaches that server, and the run says why it stopped.
- The entity view, its default section, the hosted tests and every product source are unchanged.

## Known Limits

- A development server of the same checkout and the test preview share Vite's cache directory; they were not separated.
- Two ordinary runs at once need different ports: the second is refused, not queued.
- `packages/hub/playwright.config.ts` still reuses a server on `5798`; it is outside this repair.
- The guard depends on the wording of Playwright's refusal; an upgrade that rewords it fails the guard and is corrected there.
