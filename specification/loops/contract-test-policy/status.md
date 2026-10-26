# Migration remains incomplete

Status at 2026-10-26 02:03 UTC. Global `testing: 1` remains disabled. Existing
unmigrated entrypoints and substantive assertions are retained. No production
deployment or remote-main delivery is claimed.

The migration ledger records 44 units and 692 cases:

- 17 class/service units: 129 method/state cases.
- 24 function/helper units: 559 authored Example cases.
- 3 API units: 4 request-matrix cases with complete JSON comparisons.
- No qualified page/component screenshot suite migration yet.

The last inventory records 1,110 suite files, 4,581 discovered declarations and
5,887 admission gaps. This is an inventory of remaining work, not passing proof.

## Verification boundaries

All 692 migrated cases and 16 existing guards passed on `harbor-mbp-2` at
`0a754fa6f6592204af0ecf8a7a770e1d80b51407`. The later class-audio repair passed
32 focused checks, root compiler/lint, registry validation and audit. Its
bookkeeping passed 17 unchanged checks; see the class-audio loop's playback note.
These runs do not establish the full current-tree aggregate.

The aggregate for `bc33fa884ddf07b19c9f4fe455a21393e0828632` waited from
01:32:00 to 02:02:03 UTC, then exited because resource admission timed out.
It requested five CPUs and 8 GiB on `harbor-mbp-2`; zero Vitest or Playwright
workers started. The separate formatting check also timed out without admission.
The earlier aggregate's four lint findings were repaired, but its full rerun
has not executed. Automated E2Es have not been moved to the primary Mac.

The existing worker-identity case is strengthened at
`d2d8d61c629fbb11f19dfbb8ed7150d350539dd5`, with nine existing cases unchanged.
Its corrected fixture declares known zero cache counters. The first queued
attempt was cancelled before admission; no test ran and no red record was
accepted. A replacement proof is queued on the laptop. Product repair must wait
for an observed product-caused failure against this unchanged test.

## Execution identity

The Harness task audit at 01:48 UTC covers 55 preserved attempts. All requested
`max` effort; no attempt records a fallback:

- `claude-haiku-5-5`: 20 completed and 6 failed executions report that exact model.
- `gpt-5.6-luna`: 25 completed and 1 failed executions have no reported model.
- `gpt-6-luna`: 3 failed executions have no reported model.

The Luna executions are unverified identities. Earlier accepted reviews remain
original records; they have not been rewritten as blocked or model-verified.
The pending identity loop closes future admission of unidentified completions.

## Remaining acceptance work

The comparability helper's eight-Example draft is under isolated review. The
resource-request draft was returned for repair because it converted rejections
into successful values. Neither draft changes the qualified ledger yet.

Class audio is retained in Git and native playback succeeded. Explorer's
`focusedCaptures` still excludes audio, so Examples playback is not established.
An explicit test-only module task targets its existing evidence case without
adding test declarations. The shared preview also serves another checkout and
older revision data; fresh Tests, Examples, History and screenshot acceptance
remain pending. No changed baseline has been automatically accepted.

The isolated history source remains clean at
`ae98ef2ef17fb384568401618f0211a96f36f58b`, with 2,264 frozen refs. The CLI's
`--limit 100000` selection contains 3,080 revisions and is not truncated. The
latest build has no final index. Older partial output is retained; full media
and record integrity verification is pending. Backup and snapshot commit refs
outside normal source-branch/archive selection need reconciliation before any
claim of complete source-history coverage. No old revision's tests were rerun.

The full migration, visual baseline inspection, visual/JSON mutation proof,
generated-project qualification, current-main integration and final history
catch-up remain open. Fetched remote main `8b04cd2104` has not been integrated.
