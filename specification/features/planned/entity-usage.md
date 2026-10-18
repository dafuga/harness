# Feature: Used In and Uses

## Overview

An entity says what uses it and what it uses in two sections named exactly **Used In** and **Uses**. Nothing an entity is shown with is called a relationship any more. This holds in the Reports explorer under `/harness` and in the workspace entity view that Web, Electron and iOS share, for pages, components, functions, configs and services.

Only what is shown changes. What is related to what is read from the same graph and the same recorded relationships as before.

## Acceptance Criteria

- **Used In** lists what uses the entity, the pages that show it included, each once, with a badge saying what kind of thing it is.
- **Uses** lists what the entity depends on, kept apart by kind: components, functions, configs, services, and what is none of these.
- Neither section shows a source path. Source stays under Details, then Source.
- Used In and Uses have dedicated tabs. Neither section appears in Overview or is named Relationships.
- Usage rows show names, kind/change badges and descriptions without verification marks. The entity page header retains its verification mark.
- An address of the former relationships section still opens the entity on its overview: `?tab=relationships` in the explorer and `/relationships` in the workspace.
- A link of either section opens the entity it names in the same branch and commit.
- An entity nothing uses, one that uses nothing, and one removed at the shown commit each say so, and say no more than is recorded.

## Known Limits

- The explorer follows consumers up to the pages that show an entity at any depth. The workspace lists what its catalog recorded: direct consumers and direct dependencies. The two are not made alike here.
- What a removed entity used is not listed: the relations of a revision are those of the units it holds.

## Future Enhancements

- Functions shown with recorded input and output of their tests instead of design images.
