# Chat agents panel

Project chat offers Chat and Agents views. Switching views and following a module preserves the current message draft.

The Agents view initially shows three registered main sessions, with the full roster behind the shared expandable-list control. It lists sessions with their stated tasks, provider/model, branch and current status. It reads only the selected project and never infers an agent from a process, loop or changed file. Historical views label the roster as live activity, not historical proof. Hosted projects without an activity reader show unavailable, not zero agents.

Modules being worked on groups only currently working declared assignments by registered module. Each module links to its page and names all owners; overlapping assignments show the actual count, never an assumed single owner. Unknown modules stay as text. Completed and stale sessions remain distinguishable and do not count as working module owners.

The roster refreshes on opening, every fifteen seconds while visible, and on request. Failed refresh retains the previous reading with a warning; after sixty seconds it no longer claims current work. Closing or changing project stops polling and ignores late responses. Activity is read-only and does not start, cancel or approve a model run.

Proof: extend the standard project-chat browser matrix at 1440, 920 and 390 px, including preserved draft, module links, overlapping ownership, stale status and refresh failure. Test the selected-project boundary and unavailable reader. Run normal checks and inspect fresh captures.
