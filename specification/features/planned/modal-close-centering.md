# Feature: Modal Close Centering

## Overview

The shared report modal centers its painted close icon without depending on font baseline metrics.

## Acceptance Criteria

- Reuse the existing shared close icon in a centered 44 by 44 pixel button.
- Keep the painted icon within one pixel of the button center at desktop and mobile widths.
- Preserve the translated accessible label, close-button interaction, Escape and focus restoration.
- Exercise Verification, Acceptance criteria and Workflow coverage in the existing portable report detail tests, retaining before and after screenshots.

## Future Enhancements

- Published reports are immutable snapshots; newly generated viewers include the alignment repair.
