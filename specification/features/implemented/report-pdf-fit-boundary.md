# Feature: Report PDF fitted-image boundaries

## Overview

A 1440x900 screenshot already fits the PDF evidence frame. Floating-point
division rounds the inferred source slice to 899 pixels, creating a separate
one-pixel continuation page. Preserve fitted images as one complete image.

## Acceptance Criteria

- A 1440x900 and a 1600x900 screenshot occupy one evidence page per capture.
- Cover previews and evidence retain every source row without a one-pixel page.
- Genuinely tall screenshots still paginate without losing source rows.
- The same regression fails before the repair and passes after it.
- Harness checks pass and regenerated delivery PDF pages are visually inspected.
- Existing finalized reports and original screenshot bytes remain immutable.

## Future Enhancements

- Additional print page-size profiles if requested.
