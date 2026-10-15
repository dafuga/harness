# Feature: Agent Model Settings

## Overview

The compact project agent uses model and reasoning icons. A grouped model picker lists both discovered CLIs; Settings owns the saved design-count preference.

## Acceptance Criteria

- Model and reasoning icon controls replace compact inline selectors; no design count remains there.
- The model picker lists discovered Codex CLI and Claude CLI models with availability and exact IDs.
- Reasoning choices follow the selected model; Escape restores focus without closing the panel.
- Settings saves a device-local design count from 1 to 10, defaulting to 3, across reloads.
- Visual project and thread Plans use the saved count; comments, Changes and headless Plans omit it.
- Existing approval, unavailable-provider, compact-height and revision-bound capture guarantees remain.

## Future Enhancements

- None in this change.
