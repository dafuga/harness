# Platform deployment catalog

## Goal

Expose the project's Web, iOS, Android and Desktop (Electron) targets in a dedicated Platforms section. Shells continue to describe UI frames.

## Acceptance criteria

- Platforms is reachable in the shared Explorer navigation, preserving branch and commit.
- The list opens a distinct, reloadable detail URL for each platform.
- Each detail shows its recorded runtime, deployment configuration, build/package commands, release requirements and source file links.
- Read configuration from `harness.platforms.json` at the selected Git commit; never substitute settings from another revision.
- Missing or invalid declarations are stated explicitly. An unconfigured target offers no invented build or deployment command.
- The Harness repository records its Hub Web, Electron macOS and Capacitor iOS configuration. Android is explicitly unconfigured.
- The pages are readable at desktop, tablet and phone widths and use existing navigation, icons and page styles.
- Tests prove navigation, per-revision data, missing configuration, invalid data and absence of unexpected browser errors. Preserve before/after screenshots.

## Scope

Configuration is a read-only reference. This feature executes no build, signing or deployment operation and reads no runtime credential values.
