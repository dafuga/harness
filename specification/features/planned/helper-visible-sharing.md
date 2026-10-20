# Feature: Visible Helper Sharing

## Overview

Only list pure shared helpers with at least two distinct, resolved component,
service or model consumers in the Used In row. Use the same consumer set for
inclusion and display, before the existing three-link display limit.

## Acceptance Criteria

- Every helper card has at least two distinct linked consumers in Used In.
- Exclude helpers with zero or one eligible consumer, even when other named-function references qualify the broad source contract.
- Multiple functions in one consumer unit count as one visible place.
- Excluded kinds and missing consumers do not inflate the visible count.
- Preserve pure-contract checks, three-link limit, per-export ownership, revision links and all other catalogs.
- Extend the standardized card unit test and three-viewport browser matrix; retain positive two- and three-consumer cases.

## Process Prevention

The Used In change at `5f3e02d7` exposed the older broad consumer definition without
aligning list inclusion to the visible consumer set. Its acceptance test explicitly
allowed a dash, so passing tests could not prove the existing sharing requirement.
At the acceptance-review checkpoint, require inclusion and displayed counts to use
the same resolved entity set; cover below-threshold and duplicate references in the
standardized matrix. Add this narrow rule to the project Harness skill. Prove the
matrix rejects restoring the old inclusion behavior in an isolated source archive.
