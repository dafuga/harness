# Verification checker method-state migration

`4d869005c1` registers four cases for `VerificationCheckService.check` and
`integrity` under default and explicitly injected indexer initialization. The
previously unregistered shared-checker title remains unchanged. Three cases
were added for the previously undeclared method/state coverage. The existing
Git-record chain and corrupted-log assertions now use the shared headless
budget fixture; its existing two cases remain. `3510313f9e` records that a
corrupted middle record also makes a descendant's lineage check fail.

At `3510313f9e`, all four cases passed on `harbor-mbp-2` with one Vitest worker.
The two budget fixture cases and the unchanged 16 registry guards also passed.
Registry validation passed for 1,828 units with 168 uncertain references;
focused discovery found exactly four checker titles and no contract errors.
Capture `6d53cc177ddfe8c51e972d32b63f6b434deada62544e7cb60e7ae449ca8d63aa`
passed at that revision and is retained in Git evidence. Its normal injected
integrity case took 330.515 ms and reported 164,675,584 bytes whole-worker RSS,
including shared runtime and fixture work. The source measured 5,276 bytes,
119 lines, complexity 20 and 13 dependencies; it emits no separate artifact.

The scenario wrapper emitted assertion evidence but no case outcomes. The
existing `CaseResultAdapter.onFinished` case was strengthened at `df1ae84726`
to exercise the real wrapper. Capture `2631e0b763f7` failed on the absent
`case-results.ndjson`; `eeac3ccfb4` adds the existing case reporter to the
wrapper. Capture `26437f671754` passed the same selected case. These are
independent fixture captures, not formal product red/green: the corrected
wrapper is a frozen test input and the captures reported different environment
profiles. Both original outcomes and log hashes were fetched into Git evidence.
The adapter retains its four case titles. Its source measured 3,311 bytes,
99 lines, complexity 31 and three dependencies; it emits no separate artifact.

At `eeac3ccfb4`, the checker scenario wrapper passed four cases and emitted four
passed outcomes bound to that revision, plus output and assertion captures for
both declared states. Those direct-run files are temporary, not a full
verification record. The normal injected integrity case took 407.670 ms and
reported 166,363,136 bytes whole-worker RSS. Five focused adapter, wrapper and
registry files passed 29 cases on one worker; a separately selected Desktop
observation case also passed, with its other 19 cases not run. Root typecheck,
targeted lint and registry validation passed (1,828 units, 169 uncertain
references). No browser E2E or aggregate ran.

A final checker Harness capture at `eeac3ccfb4` was stopped by the shared-memory
guard while its fixture was running. Record `7e10aed47928` remains failed in
Git evidence; its setup failure is not product proof. A successful capture for
the final source tree, the complete fixture page migration, broad verification,
current-main integration and Explorer inspection remain open.
