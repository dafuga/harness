# Feature: Atomic Component Architecture

## Overview

Harness supplies native element atoms and composes UI through molecules, organisms,
layouts/templates and pages. Feature categories, registered identities and URLs stay
independent of composition level.

## Acceptance Criteria

- Supply one canonical atom for every conforming HTML element, all input types,
  SVG building blocks and dynamic elements. Nonvisual document/definition atoms stay
  available as dependencies without pretending to have standalone visual previews.
- All owned application Svelte components use the atom library. Native compilation
  preserves attributes, bindings, actions, focus, accessibility and scoped CSS.
  Atoms add no wrapper DOM or application theme to generated tenant projects.
- Generators install the typed library and generate declared composition levels.
  New apps include its Svelte integration. Existing shared controls remain preferred
  and are built from the same atoms.
- Audit rejects missing levels, raw native markup outside atoms and unknown atom
  calls. Registry checks reject upward composition while permitting type references
  and navigation links. Used In/Uses record actual native atom consumption.
- Components can be filtered by level. Cards retain screenshot, title and the first
  three distinct Used In links, with an ellipsis when more exist.
- Local and generated agent instructions teach the same policy. Historical revisions
  keep their source and may omit composition metadata.
- Standard generator/compiler, indexing, composition and browser/catalog coverage
  exercises real interactions and registered desktop/tablet/mobile states.
- Land completed work on main, then inspect fresh current-main screenshots. Full
  CLI/native qualification remains deferred under the user's focused-check scope.

## Future Enhancements

- Extend the native element inventory as the HTML standard and supported Svelte
  element types change, preserving existing component identities and contracts.
