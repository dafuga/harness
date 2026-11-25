---
status: implemented
shippedIn: null
unitIds: [command.loop, function.development-tooling-sibling-bug-sweep]
owner: dafuga
reviewedAt: 2026-11-25
---

# Feature: Security Review

Harness uses committed, repository-owned bug classes to find possible gaps in defensive controls. A separate source review evaluates each candidate before a repair loop can start. The workflow points to a bounded set of source locations and runs without a provider by default. The pattern lists, revalidation, budgets and starter description draw on Vercel Deepsec. [Vercel Deepsec](https://github.com/vercel-labs/deepsec)

## Review a repository

1. Run `harness loop security init`. Describe the repository's entry points, trust boundaries, data and review scope in `specification/security/attack-surface.md`. Adapt `specification/security/bug-classes.json` to its defensive controls. Commit both files.
2. Run `harness loop security scan sensitive-data-in-logs > scan.json`. Use `--commit` to select a snapshot and `--review-limit` to choose how many ranked leads to include. The report contains the full match count, skipped files and the selected candidate locations. Treat those locations as leads.
3. Have a separate reviewer check the selected commit, its attack-surface description and the applicable controls. Record `confirmed`, `dismissed` or `unconfirmed` for each candidate. Run `harness loop security revalidate scan.json --decisions decisions.json > review.json`.
4. Run `harness loop security prepare-repair review.json <finding-id>` for each confirmed finding. The command requires the reviewed revision at HEAD and starts a dedicated `bug-fix` loop. Commit a failing regression for that finding's defensive invariant, repair the code in a separate commit, and record the same test passing. Complete the sibling review and normal project checks before closing the loop.

A manual decision file binds each verdict to the scanned revision and class. The example values are placeholders for the IDs from the scan.

```json
{
	"revision": "0000000000000000000000000000000000000000",
	"classId": "sensitive-data-in-logs",
	"decisions": [
		{
			"id": "00000000000000000000",
			"verdict": "dismissed",
			"impact": 0,
			"evidence": "The diagnostic contains a public status label."
		}
	]
}
```

Revalidation re-derives the candidate locations and rejects a mismatched report. It exits nonzero if a cap, reviewer error or missing decision leaves candidates unreviewed. Confirmed verdicts already recorded in a partial report remain eligible for repair. Review reports are operator attestations. Keep the files in an approved location and keep secrets and customer data out of the evidence.

## Run limits and external reviewers

Each scan, revalidation and repair preparation has a 120-second deadline by default. Set `--max-duration-ms` to change it. Static scans and manual revalidation reserve zero provider dollars.

An operator can opt into an external reviewer with `--reviewer /absolute/path/to/reviewer --reviewer-max-usd 0.02 --max-cost-usd 0.10`. Use an approved executable with a provider-enforced upper bound per invocation and reserve any applicable shared allowance at the provider boundary. Harness reserves the full per-invocation maximum before each launch and carries reservations through failures. The dollar cap applies to that reserved amount. Provider billing and enforcement of each invocation's maximum are the reviewer's responsibility.

Harness runs the executable directly in a temporary directory. It sends one JSON request on stdin per candidate. The request includes `schemaVersion`, `maximumMicrousd`, `task`, the pinned `revision`, `attackSurface`, `bugClass` and a `site` with a bounded source excerpt and `fromLine`. The executable writes one decision JSON object to stdout using the fields in the example's `decisions` array. Use a reviewer authorized to see the repository's source and description. The evaluator deadline covers queue time and subprocess execution. Reports use integer millionths of a dollar for reservation accounting.

## Acceptance criteria

- Init preserves existing files. A scan reads only the committed description, class list and tracked source.
- Revalidation records one typed verdict per reviewed candidate at the exact scanned revision and class.
- A review reserves its per-invocation maximum before running the executable and leaves remaining findings unreviewed on a cap.
- Only a confirmed finding from the current revision can open its dedicated red/green loop.
