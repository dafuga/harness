# Feature: App Style Tokens

## Outcome

Every first-party Harness interface uses the palette currently shown on Styles. Reports,
Desktop (including the shared iOS renderer) and Hub consume one documented design-token
source. Existing components remain shared; layout and interaction behavior stay intact.

## Findings

The original Styles screen listed 35 explorer variables without enforcing their use.
A source scan found 430 color literals (211 spellings, including token definitions),
364 raw font-size declarations, 193 radii and separate older Desktop/Reports palettes.
The existing standardized Styles browser test checked headings and a fixed token count;
it did not check application stylesheets or component declarations for design literals.

## Acceptance

- Use the displayed palette across all first-party application screens, per Daniel's choice.
- Document colors, fonts, type scale, text styles, spacing, borders/corners, shadows,
  opacity, motion, layering, layout/sizing and responsive breakpoints.
- Keep design values centralized, including inline component CSS. Preserve data-derived
  image positions, chart percentages, structural CSS keywords and third-party asset colors.
- Extend normal style admission tests to reject undocumented raw design decisions.
- Verify the real Styles catalog matches the shared registry and imported tokens reach all
  app roots. Breakpoints need a build-time or checked declaration path because native CSS
  variables cannot supply media-query conditions.
- Prove shared controls, navigation, dialogs, evidence cards and workspace screens remain
  usable at desktop/tablet/phone sizes, with fresh retained screenshots and measurements.
- Keep full CLI/native suites deferred as requested; report focused proof and remaining gaps.
