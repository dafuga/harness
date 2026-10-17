# Feature: Browser Console Errors

## Overview

Normal browser flows must finish without unexpected console errors or uncaught
exceptions, including runs capturing screenshots or videos. Preserve diagnostics
when an error occurs. Deliberately tested failures keep their expected logs.

## Acceptance Criteria

- Generated apps and E2E/resource scaffolds use an automatic browser error fixture.
- Harness browser suites use the same guard, including popups and explicitly watched contexts.
- Normal flows fail on console.error or pageerror without opting into evidence capture.
- Error diagnostics include message, page, source location and exception stack when available.
- Intentional error tests declare exact messages and reasons; missing expected errors and additional errors fail.
- A silent successful run writes no browser error attachment; errors remain attached even when a behavioral assertion fails.
- Guidance requires an unchanged red-green log assertion when repairing unexpected browser errors.
- Unit and temporary-workspace browser tests prove clean, failing, repaired and intentional-error paths.
- Bucket upload manifests include recorded activity so ordinary installed-console browsing does not request a missing activity object.
- The automatic guard preserves lazy fixture setup: API-only cases pass with an unavailable browser executable.

## Fixture Scope Prevention

The first version of this change made its automatic collector depend on the browser
context, adding a Chromium requirement to HTTP-only tests. A temporary-workspace
regression reproduced that failure before the repair. Context monitoring now attaches
when a context is requested; the automatic collector itself requires no browser.

The missing control was the fixture dependency review boundary. Root/generated agent
guidance now requires an API-only case with an unavailable browser executable whenever
shared browser fixture dependencies change. The case runs in the existing E2E check
alongside real browser error cases, preventing optional runtime dependencies from
spreading to unrelated test scopes. Its cost is one short browser-free runner launch.

## Future Enhancements

- Server-side logs and application deployment are outside this browser guard.

## Verification Status

The browser error regressions pass, including real popup navigation, deliberate error
diagnostics, repaired flows, lazy API-only checks, and built-CLI mutation proof. The
bucket activity regression passes with fresh inspected local-fixture screenshots.
The same unchanged bucket browser test also rejected the isolated original upload
manifest and passed after repair, saving inspected before/after screenshots at the
same rendered-content checkpoint before the browser error assertion.

Full repository verification remains pending: reports-concurrent-runs.e2e.test.ts
times out after 180 seconds while waiting for its synthetic history to be seeded,
before browser results are produced. The same unchanged test failed at the same
assertion in an isolated archive of baseline ff47c377. Its assertion and deadline
remain unchanged. Keep the report active and loop verification pending until the
repository check can pass.
