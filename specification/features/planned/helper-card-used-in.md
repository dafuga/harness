# Feature: Helper Card Used In

## Overview

Show each helper's first three distinct component, service or model consumers beneath
its example invocation. Use smaller text and real links that preserve revision scope.

## Acceptance Criteria

- Every helper card has a smaller Used In row; absent eligible consumers show a dash.
- Resolve each exported helper's own runtime consumers, not module-wide dependencies.
- Skip missing units, pages, functions and duplicate consumer ids before limiting to three.
- Preserve recorded consumer order and use readable entity names.
- Component, service and model links open their entity within the same branch and current/commit scope.
- Keep the invocation link, concise layout, responsive grid and existing shared navigation.
- Extend the standardized catalog browser matrix and card unit tests. Existing tests required a single link and did not cover usage; update those assertions before product changes.
