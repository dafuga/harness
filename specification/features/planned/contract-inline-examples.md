# Feature: Compact Contract Examples

## Overview

Contract tables show Name, Type and Example. Each row ends with an info action that opens the full existing example modal.

## Acceptance Criteria

- Replace the Description column with a one-line example preview for inputs, outputs and errors/config provisions.
- Clip long examples with an ellipsis inside their cell. Preserve full values and descriptions in the modal.
- Put the accessible info action in the final column, with the existing keyboard and focus behavior.
- Preserve false, zero, null, empty strings, structured data and escaped markup. Show missing or illustrative examples honestly.
- Preserve revision routing and fit desktop, tablet and phone viewports.

## Verification

Strengthen the existing entity-contract, entity-details and responsive entity preview checks, including a long shared fixture. Commit and record their failing checkpoint before the UI change, then record the unchanged passing checkpoint.
