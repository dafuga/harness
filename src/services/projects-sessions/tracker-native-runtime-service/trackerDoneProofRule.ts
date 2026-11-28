// @harness-uid u_rwxks6olfz
export const trackerDoneProofRule = `## Done proof

Read the \`computer-hygiene\` skill before using a browser, app, simulator, container or background process. On every computer, track and close only the tabs and windows you opened as soon as you finish with them. Leave Daniel’s and other sessions’ resources alone.

- Before \`tracker done\`, \`tracker block\` or handoff, check your list. Put this on its own line in the done note or block reason: \`hygiene: closed <N> tabs/windows I opened; left open: <none or what and why>\`. Use 0 and none if you opened nothing. Tracker requires this line for launched sessions.

Before \`tracker done\`, reread every note with \`tracker show <id> --json\`. This brief may omit or shorten notes, and requirements can be appended after launch.

- The done note maps EVERY requirement (title, task and all notes, including appended ones) to evidence for each named computer: \`<requirement> | <computer> | <evidence>\`.
- For a live symptom, wait out any grace period, then observe the symptom itself on the live system. Tests, a merge, a deploy or no eligible case are not that observation.
- A mocked route, a direct call that skips a hop, or a test using a setting the installed app lacks is not proof of a live path; name any such substitute in the done note and what it stood in for.
- A release item lists every component in Daniel's approval wording and the brief, including iPhone when either names it, and reads back each installed version. If a component is missing or a required live check is \`not seen\`, it stays open or blocked.
- If anything is unproven, unseen or not rolled out, do not run \`tracker done\`: flag it if Daniel must decide; otherwise note what is left and leave the item open or blocked.
- In a bug-fix loop, the done note shows the \`siblings\` and \`verify\` steps as complete, or lists each as skipped with the reason.`;
