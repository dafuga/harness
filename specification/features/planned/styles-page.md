# Feature: Styles Page

## Overview

Readers can open a dedicated Styles screen from the Harness navigation and inspect the design tokens the app supports. The screen is scoped to the current branch and commit like other Harness pages, while styles remain a design-system view rather than an entity category.

## Acceptance Criteria

- A Styles item appears in the Harness navbar and opens `/harness/branch/<branch>[/commit/<sha>]/styles`; changing branches or commits preserves the Styles screen.
- The screen documents every globally supported `--hx-*` token, including the color palette, font families, type sizes, text weights/styles, and shared shape or spacing tokens.
- Token names and displayed values come from the app's actual CSS custom properties; adding a supported token makes it visible without maintaining a second inventory.
- The page presents color swatches and readable typography specimens, groups tokens by purpose, and remains usable without horizontal overflow on desktop, tablet, and mobile.
- A browser regression proves navigation scope, token groups and values, and responsive rendering at all three viewport sizes. The same regression captures before and after screenshots.

## Future Enhancements

- Add a focused token search or copy-to-clipboard action if the catalog becomes large enough to need it.
