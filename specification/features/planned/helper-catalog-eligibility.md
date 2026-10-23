# Feature: Helper Catalog Eligibility

## Overview

Only explicitly pure functions with at least two distinct runtime consumers belong in Helpers. A function with one consumer is private to that consumer.

## Acceptance Criteria

- Apply the existing helper contract to explorer classification, search, relations, and catalog membership.
- Missing purity or consumer proof, zero consumers, one consumer, and repeated references from the same consumer never qualify.
- Distinct named functions count separately even when declared in the same registered unit; forwarding exports and type-only references do not count.
- Private functions remain linked from their owner's Uses section and retain contract, examples, source, and history access. Their breadcrumb names the owner when uniquely known, otherwise Function, never Helpers.
- Source metadata stays pinned to the selected revision; desktop, tablet, mobile, current and historical views use the same rule.

- Public helper implementations live in `src/helpers/<responsibility>/`, separated from component and service orchestration. Private single-consumer functions stay with their owner.
- A selected helper's Source tab and viewer expose only its recorded helper implementation, even when the registered module owns other component files. Older revisions retain their own recorded paths.
- Registry validation rejects public helper source outside the categorized helpers tree or outside its registered ownership. The helper generator emits a pure function with a descriptive parameter; generated agent and skill guidance require the same placement.

- General casing, pluralization, identifier shortening and display-duration helpers belong in `src/helpers/strings/`. Domain-specific helpers keep a domain folder. List headings and selected-helper breadcrumbs derive their category from that callable source, rather than its owning module or consumers. Historical views retain their own category titles.
