// @harness-uid u_rwxks6olfz
export const trackerDoneProofRule = `## Done proof

Before \`tracker done\`, reread every note with \`tracker show <id> --json\`. This brief may omit or shorten notes, and requirements can be appended after launch.

- The done note maps EVERY requirement (title, task and all notes, including appended ones) to evidence for each named computer: \`<requirement> | <computer> | <evidence>\`.
- For a live symptom, wait out any grace period, then observe the symptom itself on the live system. Tests, a merge, a deploy or no eligible case are not that observation.
- If anything is unproven, unseen or not rolled out, do not run \`tracker done\`: flag it if Daniel must decide; otherwise note what is left and leave the item open or blocked.
- In a bug-fix loop, the done note shows the \`siblings\` and \`verify\` steps as complete, or lists each as skipped with the reason.`;
