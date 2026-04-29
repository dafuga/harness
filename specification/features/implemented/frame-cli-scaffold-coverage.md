# Feature: Frame CLI Scaffold Coverage

## Overview

Frame provides a Rails-like generator catalog for app and package projects. The CLI keeps command files thin, delegates generation to workflow helpers, protects existing files by default, and verifies generated projects through unit and E2E tests.

## Acceptance Criteria

- `frame new app` and `frame new lib` create detectable Frame projects.
- `frame generate` supports model, controller, view, layout, API, component, service, decorator, adapter, repository, validator, serializer, policy, job, notification, seeder, command, util, test, feature, migration, store, hook, and e2e scaffolds.
- App-only scaffolds fail cleanly outside app projects.
- Lib/package-safe scaffolds update `src/index.ts` exports in lib projects.
- Existing files are protected unless `--force` is passed.
- Generated app and lib projects pass their own check, test, and build commands.

## Future Enhancements

- Add richer app-template copying once Frame grows beyond minimal scaffolds.
- Add dApp-specific scaffolds only when the CLI intentionally supports dApp projects.
