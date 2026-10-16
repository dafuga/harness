# Feature: Agent Entity References

## Overview

Agent conversations in the shared workspace name the units they are about as links. The project
agent at the bottom right and the thread of an entity show a link for each unit the agent works on
or names, in streamed text, in stored messages, in questions it asks and in its progress and
results. A reference is written inline as `[[unit:<id>]]` with a registered unit id; agents are
told to write it, and one shared component renders it.

## Acceptance Criteria

- A reference becomes a link only when its id has the unit id grammar (lower-case dotted
  segments) and names an entity of the selected project at the revision in view. The link opens
  the entity's canonical address with project, branch and pinned commit kept (a shell under
  `/shells/`).
- A reference to an id the registry does not hold, a malformed id, or anything shaped like a URL,
  a path or markup stays plain text exactly as written. No HTML is interpreted, no external
  address is ever a link and no other project is reached.
- Streamed text that splits a reference across chunks shows the reference as text until it is
  complete, then as a link; nothing of the text is lost.
- Stored messages, streamed text, the agent's questions, run progress and results render
  references the same way. Messages written before references existed render as before; no
  stored schema changes.
- The thread of an entity names that entity as a link while an agent works on it, even before
  the catalog lists it; a plan created by the project agent resolves once the catalog refreshes.
- Plan and change prompts tell the agent to name units as `[[unit:<id>]]` and list the ids it may
  name: the entity, its registered relationships and the units of its declared contract. The
  creation prompt does the same for the catalog it is given.
- A completed change names the units that own its changed files, as references, where the
  registry's source ownership proves it; files no unit owns are counted, never listed.
- Hosted projects stay comments-only and render references in comments without any agent control;
  local and remote projects keep their capability gates. A request or comment keeps its full text
  as written, references included.

## Future Enhancements

- A typed reference field for stored messages, should references need more than an id.
