# Feature: Helper Catalog Eligibility

## Overview

Only explicitly pure functions with at least two distinct runtime consumers belong in Helpers. A function with one consumer is private to that consumer.

## Acceptance Criteria

- Apply the existing helper contract to explorer classification, search, relations, and catalog membership.
- Missing purity or consumer proof, zero consumers, one consumer, and repeated references from the same consumer never qualify.
- Distinct named functions count separately even when declared in the same registered unit; forwarding exports and type-only references do not count.
- Private functions remain linked from their owner's Uses section and retain contract, examples, source, and history access. Their breadcrumb names the owner when uniquely known, otherwise Function, never Helpers.
- Source metadata stays pinned to the selected revision; desktop, tablet, mobile, current and historical views use the same rule.
