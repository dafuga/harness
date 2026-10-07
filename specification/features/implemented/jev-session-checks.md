# Feature: Jev Session Checks

## Overview

Run advisory Jev Clean Code reviews automatically when local Codex sessions start
or resume in Harness-governed projects. Use the existing bounded, file-by-file
classifier and cache, keeping startup responsive with a background hook.

## Acceptance Criteria

- Install one idempotent SessionStart hook matching startup, resume and clear.
- Restrict reviews to configured project roots and their Git worktrees; require
  harness.audit.json and preserve unrelated hooks.
- Read only an owner-only Harness checker credential file. Never embed the key
  in a command, URL, hook definition, settings file or result.
- Reuse unchanged judgments and invalidate them when source or context changes.
- Exclude ignored, sensitive and unsupported paths using existing discovery rules.
- Surface violations, uncertainty and incomplete execution as advisory context.
- Prove the behavior with unchanged CLI regressions and mocked Jev responses.
- Install a stable bundle and review the hook through Codex's normal trust flow.
  Never bypass trust or claim activation before the installed definition is trusted.

## Verification

Focused session-hook unit and CLI tests, the full project check, an installed
bundle dry run, and Codex discovery/trust verification. No live credential probe.

## Future Enhancements

- Additional completion-time or changed-file-only checks can build on this
  startup integration. The current review describes the startup source snapshot.
