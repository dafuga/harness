# Feature: Regression Commit History

## Overview

Regression repairs keep two source commits: the strengthened test that fails on unchanged
product code, then the fix on which that same test passes. Harness runs both from clean
exports and keeps their results in its existing Git evidence branch and notes. The shared
app displays the failure, passing result, exact commit links, command and recorded output.

## Acceptance Criteria

- New bug-fix, fix and regression-prevention loops require committed checkpoints before
  completing red, implementation, green or verification steps. Older loops retain their
  original evidence without invented commit links.
- The red commit changes tests, shared test fixtures or loop documentation, with no product
  repair. Its declared assertion must appear in failing output. A timeout, missing command,
  snapshot mutation or unfinished child process is not accepted as proof.
- Green is a separate descendant commit with a product change. The test corpus, shared
  fixtures, scenario definitions, runner configuration, lockfiles, command and environment
  remain unchanged. Additional inputs outside the standard test folders are named with
  `--test` as well. Green inherits its command and inputs from the stored red checkpoint.
- Both outcomes stay immutable and commit-bound. Failed checkpoints remain failed; a focused
  passing checkpoint does not establish full verification or a budget baseline.
- Repeated or concurrent records are retained. Notes and evidence synchronize through the
  existing history commands; a fresh clone rebuilds the same proof without a local database.
- History and test/evidence views reuse one responsive component in the web, Electron and
  iOS renderer. A red commit shows only its failure; the fix links back to that exact result.
  Missing, copied or damaged evidence produces an explicit gap.
- A paired result says the regression is fixed and labels its historical failure "Before fix"
  and its passing result "After fix". A red-only revision cannot claim a passing fix.
- Agent instructions require this sequence and preserving both commits when landing. The
  final source head must still pass normal verification; intermediate expected failures are
  never relabeled as passing commits.

## Commands

```sh
git add test/example.test.ts
git commit -m 'fix: commit failing example coverage'
harness loop record example --phase red --test test/example.test.ts \
  --unit function.example --command 'bun x vitest run test/example.test.ts' \
  --assertion 'Expected the selected item'
# Complete red, repair the product, and commit the fix separately.
git commit -m 'fix: return the selected item'
harness loop record example --phase green
```

Recordings append to `refs/notes/harness` and `harness-evidence` after the source commits
exist. `harness history push origin` and `harness history fetch origin` synchronize them
using the existing controls.

## Verification boundary

The full repository check remains pending while Electron acceptance is paused. An unchanged
starting-revision lint error also remains in `packages/desktop/test/ios-simulator-build.test.ts:25`
(`no-nested-ternary`). Focused regression proof does not waive either check.
