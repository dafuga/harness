// @harness-uid u_rwxks6olfz
export const trackerDoneProofRule = `## Done proof

Before \`tracker done\`, reread every note, one bounded page at a time: \`tracker show <id> --notes-page 1\`, then each next page it names. This brief may omit or shorten notes, and requirements can be appended after launch.

- For a user-facing feature delivery, use \`bun scripts/deliver-feature.ts <item> <dev|staging|live> --note "<done proof>" -- <headless capture command>\`. The command records and attaches the video link before finishing the item. The capture runs the built app and writes \`feature-delivery.webm\` under \`HEADLESS_RUN_ARTIFACTS\`. Show the MOCK badge when the walkthrough uses simulated operations.
- The done note maps EVERY requirement (title, task and all notes, including appended ones) to evidence for each named computer: \`<requirement> | <computer> | <evidence>\`.
- For a live symptom, wait out any grace period, then observe the symptom itself on the live system. Tests, a merge, a deploy or no eligible case are not that observation.
- A mocked route, a direct call that skips a hop, or a test using a setting the installed app lacks is not proof of a live path; name any such substitute in the done note and what it stood in for.
- A release item lists every component in Daniel's approval wording and the brief, including iPhone when either names it, and reads back each installed version. If a component is missing or a required live check is \`not seen\`, it stays open or blocked.
- If anything is unproven, unseen or not rolled out, do not run \`tracker done\`: flag it if Daniel must decide; otherwise note what is left and leave the item open or blocked.
- In a bug-fix loop, the done note shows the \`siblings\` and \`verify\` steps as complete, or lists each as skipped with the reason.`;
