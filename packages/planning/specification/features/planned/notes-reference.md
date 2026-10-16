# Feature: Notes Reference

## Overview

Thread comments can reference an immutable headless design by its version and notes hash.

## Acceptance Criteria

- Only a present notes artifact from the same entity with the exact hash may be referenced.
- Missing notes, wrong hashes, and unknown versions fail before a Git mutation.
- Existing empty, image, and approval references remain readable without rewriting history.

## Future Enhancements

- No historical backfill or inferred references.
