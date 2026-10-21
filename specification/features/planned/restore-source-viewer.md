# Feature: Restore Source Viewer

## Overview

Restore a View code action beside every implementation file in an entity's Source
tab. Reuse the existing read-only modal from `dafuga/source-code-modal`, with
category folders, canonical code names and main's newer navigation intact.

## Acceptance Criteria

- All seven entity kinds show category implementation files, each with a safe
  GitHub link and a View code action. Symbols and execution targets stay absent.
- A file action opens its exact committed text first in the shared modal. File
  switching, Escape, closing and delayed reads preserve the Source address/focus.
- Code remains escaped text and never comes from a dirty working tree. Histories
  without source snapshots show an explicit gap.
- The standard Source matrix covers desktop, tablet and phone widths, historical
  revisions, multiple files, encoded names, stale reads and legacy histories.
- Preserve separate committed red/green proof and original before/after captures;
  run relevant checks and inspect the real AgentActivityService modal.
- Land the verified branch on main, preserving the repository's regression history.

## Coverage diagnosis

The current standard Source coverage checks filenames and removed metadata. It
does not require a per-file modal action or compare file contents to Git blobs.
Restore and extend the existing source-viewer category matrix and history source
fixture, combining them with category-folder fixtures. Keep preview data and
test code identical between the committed red and green runs.

## Future Enhancements

- Editing and saving code remain outside this read-only viewer.
