---
status: planned
shippedIn: null
unitIds: []
owner: null
reviewedAt: null
---

# Contract defaults in unit manifests

At `ddd08293ac`, 311 unit manifests contain the text `undefined (omitted)`. The Svelte prop indexer currently writes that text as a JSON string when an optional prop has no initializer. A real string default can have the same spelling, and the stored value alone cannot distinguish them.

## Proposed representation

Keep schema version 1 and the existing `default` field for concrete JSON values. Add an optional `defaultKind` field to the contract item with two allowed values. Enforce mutual exclusivity with `default` wherever the item schema is used, including storage fields that extend it.

| Source declaration or evidence                                                               | Stored fields                                          | Guide and contract detail                                     |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------- |
| Optional input with no initializer                                                           | `required: false`, `defaultKind: "omitted"`            | Optional, no default                                          |
| Explicit initializer that resolves to `undefined`                                            | `required: false`, `defaultKind: "undefined"`          | Default `undefined`                                           |
| Literal initializer                                                                          | `required: false`, `default` containing the JSON value | Default with the literal's JSON representation                |
| Historical item with no default metadata, or a default expression the indexer cannot resolve | Neither default field                                  | Preserve known requiredness and leave the default unspecified |

Derive optionality from the source. Keep the indexer static. Recognize a bare `undefined` initializer only when its binding is known to be unshadowed. A statically understood `void 0` has the same value. An empty `$bindable()` on an optional Svelte prop is an omitted initializer, and `$bindable(undefined)` is an explicit undefined default. Preserve concrete values including `false`, `0`, `null`, `""`, arrays, objects and the literal string `"undefined (omitted)"`.

## Compatibility and migration

1. Land reader compatibility in its own pull request before enabling the writer. Cover the unit schema and registry, CLI guide, Reports contract detail, and any exported or serialized contract views. Pass through the new field where the view consumes default metadata. Both readers and writers must preserve old concrete defaults and historical records without default metadata.
2. Old readers use strict validation. Verify that supported installed consumers can read the new field before landing the writer and regenerated manifests. Read historical manifests at their pinned revision and leave their stored JSON intact. Where pinned source resolves a legacy string unambiguously, the reader can display the resolved disposition. If source is unavailable or ambiguous, display the stored literal without claiming it was omitted.
3. Update the Svelte prop and callable parameter indexers together. Limit default metadata changes to supported input shapes. Preserve the current JSON decoding of storage defaults and nested literal members. Avoid evaluating arbitrary initializers.
4. Regenerate current derived manifests from the corresponding source. Preserve unit IDs, UIDs, authored descriptions, examples and unknown reasons. Review declared contracts and any unresolved markers individually. Do not bulk-replace the string. Compare counts and representative rows before and after. A second indexing run must produce an empty diff.

## Acceptance and verification

- Exercise omitted, explicit undefined, concrete defaults and unresolved expressions in the existing contract and documentation cases. Include a real string equal to the legacy marker and a shadowed `undefined`.
- Read legacy and regenerated manifests with the same current reader. Confirm both literal and metadata values survive serialization, stale comparison and re-indexing. Reject a row containing both default fields.
- Inspect the CLI guide and the existing Reports contract detail for the same examples. For a changed Reports surface, use the existing browser cases and capture the exact committed build on harbor-mbp-2.
- Run type checks, focused schema/index/guide tests, registry checks and the repository check. Keep the writer and migration pending until the representation and reader rollout order are approved.
