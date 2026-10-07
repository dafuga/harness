# Feature: Jev Agent Skills

## Overview

Give future Codex sessions focused, discoverable guidance for Jev Clean Code
reviews and the automatic session checker. Maintain the skills in Harness and
install their current copies in the local Codex skill directory.

## Acceptance Criteria

- Install two automatically discoverable skills: harness-jev-clean-code and
  harness-jev-sessions, with valid frontmatter and UI metadata.
- Link both from the project Harness skill, AGENTS.md and global harness-project.
- Explain the implemented rubric, verdicts, audit exit codes, cache, credential
  transport, source-snapshot limits and Codex's normal hook trust flow accurately.
- Keep setup and offline verification distinct from live classifier accuracy.
- Validate skills, exercise their offline commands, verify Codex discovery for
  Harness and another local project, and run the normal project check.

## Future Enhancements

- Package skill installation in a future Harness distribution when requested.
