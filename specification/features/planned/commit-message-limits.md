# Feature: Commit Message Limits

## Overview

A repository that declares `"writing"` in `harness.verify.json`, as 1 or 2, holds its commit
messages to the writing limits. The subject has at most 72 characters and starts with `feat:`, `fix:`,
`chore:` or `cleanup:`. An optional body, trailers included, has at most 60 words and 400
characters. An opt-in commit-msg hook refuses a message before the commit exists, and
verification measures the stored messages of the commits it verifies, so a commit made with
`--no-verify` does not pass.

## Acceptance Criteria

- A subject of exactly 72 characters and a body of exactly 60 words or 400 characters pass; one
  character or one word more is refused with the field, the count and the limit.
- An empty subject and a subject without one of the four prefixes are refused.
- Line endings count once and characters are Unicode code points; one giant token is refused by
  its characters.
- `harness hooks install` installs commit-msg beside pre-push. A hook that was there runs first
  for each stage with the same arguments, and `harness hooks uninstall` restores both byte for byte.
- The commit-msg wrapper reads the message file it is given and never reads input.
- A real `git commit` with a message over a limit is refused and makes no commit; a short one
  is made. What Git writes into an edited message file as comments is not counted.
- A sibling worktree is unaffected until it opts in. A repository that does not declare the
  limits is not held to them, by the hook or by verification.
- A stage acts only in a worktree that opted into that stage. Each stage has an opt-in file of
  its own in the worktree's Git directory: `harness-hooks` for pre-push, as every version wrote
  it, and `harness-hooks-commit-msg` for commit-msg. A wrapper never reads the file of another
  stage, and `hooks status` says for each stage whether it is enabled here.
- A worktree that opted into pushes under an earlier Harness is never handed commit-msg: its
  commits start no Harness, its pushes start its own Harness once, and its opt-in file is left
  byte for byte. Installing again replaces the first commit-msg wrapper, which read the push
  opt-in.
- `harness hooks uninstall` removes the wrapper of a stage, and restores the hook that was
  there, once no worktree asks for that stage; a stage another worktree still uses stays.
- Shared-stage invariant: a change to the wrappers, or a stage added to them, is proven in one
  repository with three worktrees on its hooks directory — one opted in as an earlier Harness
  did, one opting in now, one that never did — with every command line recording how a hook
  started it. No Harness is started for a stage a worktree did not ask for.
- A commit made with `--no-verify` whose stored message is over a limit fails verification of
  that commit, naming the commit, the field, the count and the limit. A stored body line that
  starts with `#` is counted.
- Only source commits after the proven base up to the verified commit are measured; commits of
  evidence and commits whose tree does not declare the limits are not.
- The pre-push wrapper is byte-identical to the one before this change, and `hooks status`
  keeps its pre-push fields.
- The limits are stated in the hooks and explain guides and in the agent instructions.

## Proof

- `test/utils/commit-message.test.ts`, `test/utils/hook-script.test.ts`,
  `test/services/commit-message.test.ts`, `test/hooks-commit-msg.e2e.test.ts`, and the
  unchanged `test/hooks.e2e.test.ts`.
- Shared stages: `test/hooks-shared-stages.e2e.test.ts` (real commits and pushes in a temporary
  repository with an earlier opt-in, a new one and none; fixture in `test/support/sharedHooks.ts`,
  the earlier wrappers verbatim in `test/support/legacyHooks.ts`), `test/services/hook-install.test.ts`
  and the invariants over every stage in `test/utils/hook-script.test.ts`. Loop
  `hook-stage-adoption` holds the red and green runs.

## Future Enhancements

- A way for `harness explain add` to replace a reason that is current but over the limits.
