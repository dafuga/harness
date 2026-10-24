# Feature: Unified Colors catalog

## Overview

Styles has one Colors section combining role guidance, real CSS variables and values.
Primary names one base color; transparent fills, borders and contrasting ink are supporting
treatments, not additional primary colors. Existing palette and shared action semantics stay intact.

## Acceptance Criteria

- Render exactly one Colors section and no separate Color roles section or repeated raw inventory.
- Keep Primary, Secondary, surfaces, text, success, warning, danger and information guidance.
  Primary has one explicitly labelled Base color (--hx-gold); related variables are labelled Treatments.
- Show every real color variable once, with its declared value, browser-resolved swatch and usage.
  Preserve all shared tokens and noncolor categories, including honest coverage of future color tokens.
- Extend the existing standard Styles catalog assertion, used by both component and actual-route tests.
  Retain failing and passing screenshots at desktop/tablet/mobile with unchanged regression inputs.
- Preserve selected branch/revision, shared controls, readable phone layout and no unexpected browser errors.
- Opus5.5/xhigh makes bounded actual frontend edits; Codex reviews, verifies and integrates.
  Coordinate serialized checks and managed preview publication. FullCLI/native remain user-deferred.

## Coverage diagnosis

The existing expectColorRoles assertion required separate role guidance but allowed a second raw
inventory and several equally weighted primary swatches. Strengthen that shared assertion to require
a single Colors section, an explicit single base primary, subordinate treatments and complete unique tokens.

## Future Enhancements

No palette redesign or navigation changes are part of this request.
