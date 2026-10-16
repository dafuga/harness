# Feature: E2E Test Deadlines

## Overview

Two tests failed in a full check for reasons of machine load, not of the product. The activity E2E proved that a quiet agent goes stale by letting one second pass on the wall clock, so a roster that started late found a legitimately refreshed agent stale again. It and the JPEG PDF test also ran under the five-second default of the test runner, although each starts several processes.

The repair is in the tests only. Expiry is proven by giving the stored heartbeat an age through the agent registry, under an allowance far longer than a case runs, and the real CLI judges it by its own clock. Each case states how long its own work may take.

## Acceptance Criteria

- `test/activity-agents.e2e.test.ts` keeps its seven cases and every earlier assertion. The heartbeat case shows on the real CLI: quiet within the allowance is working, quiet beyond it is stale and not counted, a heartbeat makes it working again with what it restates, and quiet beyond the allowance again is stale again.
- No case waits for an allowance to pass, and none depends on several CLI starts fitting into one second.
- `packages/reports/test/jpeg-pdf-preservation.test.ts` differs from before only by its deadline: the fixture, the embedded-byte, the size and the 3000-row assertions are byte for byte what they were.
- Each case of both files states its execution deadline: 60 seconds where CLI processes are started, 30 seconds where Python is.
- No product source, configuration or package file changes; the liveness rule and its time-to-live are untouched.

## Known Limits

- A deadline bounds the work of a test and is no latency budget of the product.
- The full repository check was not run for this repair; Root runs it.
- The stored heartbeat is aged through `AgentRegistryRepository`, so the test knows where an agent's heartbeat is kept.

## Host Files

Agent host-file changes, tracked as metadata only:

- Claude project memory `~/.claude/projects/-Users-danielfugere-projects-harness/memory/harness-shared-checkout-gotchas.md`: owner `7f0b5b97-5297-4f84-88b7-4cd142055979` added two notes. Before SHA256 `86f7c9e20f1f5cde233ca07a1aad038301ad80b217e8ae46626ac561d0d0434f`; after SHA256 `6b96acdc9780634f047fcab6ae4d2337b8be9df9338e05cbcce43cbc1c0946d8`, 9470 bytes. Contents remain private.
- Task-owned proof outside the repository: `/tmp/harness-test-robustness/`. Nothing else on the host was changed.
