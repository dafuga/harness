# Feature: Browser Error Evidence

## Overview

Component Evidence and Tests retain browser error diagnostics from their recorded Playwright checks. A person can read the exact expected or unexpected error and its source without finding a separate Playwright report.

## Acceptance Criteria

- Record diagnostics before the browser-error assertion, including when an expected error is missing or another assertion failed.
- Keep the test title, project, retry, browser, observed errors, expected messages and reasons through verification and history, including inherited records.
- Both component viewers show expected, unexpected and missing expected errors beside the corresponding check. Duplicate messages consume expectations one at a time.
- Error text, source and stack remain readable at desktop and mobile widths using existing disclosure and typography patterns.
- A clean run writes no error diagnostics; an old record without diagnostics makes no new claim about logging.
- Malformed diagnostics fail verification visibly. A timed-out check cannot contribute trusted diagnostics.
- The same failing browser regression passes after the repair, with fresh inspected before/after screenshots.

## Future Enhancements

- Component scaffold behavior tests and unlinked component scenarios are separate work.
