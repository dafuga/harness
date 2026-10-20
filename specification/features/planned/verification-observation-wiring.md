# Feature: Verification Observation Wiring

## Overview

Verification records contain the assertions and media actually produced by the exact registered tests, and test orchestration remains responsive while native tools run.

## Acceptance Criteria

- Run recorded-preview assertions through the existing observer, including awaited polling results.
- Keep the catalog test allowlist exact and execute binary and metadata tests in separate registered commands.
- Reject extra runner targets before any test or capture can start.
- Preserve native build deadlines, output limits, signing checks and failure outcomes while allowing worker communication.
- Capture ready fonts and decoded images despite background polling; reject broken images.
- Wait for the exact audio source, play the real clip and retain its served bytes and transcript.
- Reproduce failures before repair and pass the same assertions afterward. Full checks and clean revision verification remain required.

## Future Enhancements

- Fixtures prove framework behavior; they do not establish coverage for an unrelated application.
