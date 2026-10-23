# Feature: Subagent Benchmarks

## Overview

Compare explicit Codex and Claude configurations against fixed component contracts
in controlled local trials. A contract consists of interface/behavior requirements,
exact implementation file paths, and executable checks pinned to a Git revision.

## Acceptance Criteria

- `benchmark validate <definition>` validates and resolves a commit, previews the
  trial budget, and checks local runner availability without model calls.
- `benchmark run <definition> [--seed text] [--json]` creates fresh independent
  workspaces and sessions in reproducibly shuffled, sequential trials. The working
  checkout, login sessions, and global provider defaults stay intact.
- Every submission is independently evaluated against original tests. Protected
  edits and symlink substitutions invalidate a trial. Only allowed implementation
  files are copied to a fresh evaluator workspace. Agent commits cannot hide edits.
- Capture first-submission and eventual success separately, with three repetitions,
  a 15-minute total deadline, and two repairs by default. Fixed checks are visible;
  a submission is a completed runner response, not each internal agent iteration.
- Record per-check outcomes, patches, time, repairs, requested/reported models,
  and available author usage. Missing values remain unknown. Claude's reported
  cumulative cost is an estimate, not subscription billing; evaluator usage is separate.
- Persist each trial atomically outside Git and record attributed summary events
  in existing analytics. `benchmark results <run-id> [--json]` reads durable results;
  `analytics benchmarks` exposes history without raw prompts or test output.
- Errors, exhausted repairs, invalid edits, timeouts, and interruptions remain
  visible. Interrupted trials are not automatically retried or replaced.
- Configurations explicitly select model, effort, instructions, and tool preset.
  Codex supports its default tools; Claude also supports a file-only preset.
  Unsupported settings and reported model mismatches fail without fallback.
- Use existing subscription authentication only, with provider/API environment
  overrides removed. Workspace separation is reproducibility, not an OS sandbox.
- Temporary-workspace CLI tests and deterministic runners prove all outcomes;
  the full project check and bounded real-runner smoke tests verify integration.

## Future Enhancements

- Reports comparison UI, held-out checks, additional tool/provider adapters,
  automatic agent selection, and security sandboxing are outside this version.
