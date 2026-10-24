# Feature: Config Expression Previews

## Overview

Configs shows the beginning of committed regexes and computed expressions directly in the Value cell. Long or multiline text occupies one ellipsized line; its full source is available on hover. Configuration is never evaluated for presentation.

## Acceptance Criteria

- Current and historical Configs show short expressions, long regexes and multiline expressions inline at desktop, tablet and mobile widths.
- Full committed expression text is preserved and escaped, with no expression-only inspector button.
- Object and array inspectors, scalar types and decoded strings retain their existing behavior.
- Table words remain readable, cells contain overflow and the document fits its viewport.
- The existing groups and word-geometry browser matrices pass without unexpected browser errors.

## Coverage diagnosis

The earlier string change deliberately preserved the expression inspector. The standard mixed-config matrix consequently asserted that long computed source opened a modal and had no long-regex fixture. Extend that same matrix with the requested inline expression behavior, retaining the collection checks and revision boundaries.
