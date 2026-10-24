# Feature: Semantic Style Roles

## Overview

Expose application design decisions as real CSS custom properties named for their use. A component
uses a role such as `--hx-color-primary`; Styles shows that role, its current assigned value and
what it controls. Apply the same principle to typography, spacing and other shared style families.
Preserve existing appearance while replacing the palette-facing public API.

## Acceptance Criteria

- Colors include real primary, secondary, tertiary, success, warning, error, info, background and
  surface assignments. Primary has one base property; derived states remain subordinate.
- Typography includes body, heading and code families, with body, heading and caption sizes.
  Spacing includes section, control and inline roles; corners include control and panel roles.
- Role properties are consumed by the real shared application styles. Reassigning primary changes
  selected navigation, body family changes shell typography, and section spacing changes group gaps.
- Styles shows role names, variables, resolved assigned values and usage. Preserve complete token
  coverage and all existing design categories; foundation/compatibility variables cannot masquerade
  as the public roles. Never fabricate usage labels for variables the application does not consume.
- Extend the existing Styles component/route matrices and token admission coverage. Commit genuine
  test-only RED before repair; preserve unchanged tests/fixtures/environment through GREEN.
- Use exact first-party Claude.ai Max Opus5.5/xhigh for actual subjective frontend changes.
- Verify Reports, Desktop and Hub consumers, types/lint/audit/registry/readability and fresh responsive
  screenshots. Coordinate main integration and the shared5690 publication; preserve historical proof.

## Future Enhancements

- Theme editing UI, saved user overrides and palette redesign are outside this request.
