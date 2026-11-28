// @harness-uid u_rwxks6olfz
export const trackerDoneProofRule = `## Done proof

Before \`tracker done\`, reread every note with \`tracker show <id> --json\`. This brief may omit or shorten notes, and requirements can be appended after launch.

- The done note maps EVERY requirement (title, task and all notes, including appended ones) to evidence for each named computer: \`<requirement> | <computer> | <evidence>\`.
- For a live symptom, wait out any grace period, then observe the symptom itself on the live system. Tests, a merge, a deploy or no eligible case are not that observation.
- A mocked route, a direct call that skips a hop, or a test using a setting the installed app lacks is not proof of a live path; name any such substitute in the done note and what it stood in for.
- A release item lists every component in Daniel's approval wording and the brief, including iPhone when either names it, and reads back each installed version. If a component is missing or a required live check is \`not seen\`, it stays open or blocked.
- For native onboarding, device linking, approval or permission changes, apply the installed-device acceptance gate to each affected shipped surface. Use the signed installed build and supported setup from the specified entry state. Observe a real Google return, approval on the actual paired or approving host where required, the first meaningful action in the app, and its authoritative readback. Use a physical iPhone for iPhone proof. TestFlight availability, a simulator, a synthetic callback, a copied public key, launch settings, prelinked state, injected sessions or grants, and direct API answers cannot satisfy those hops. Preserve existing sessions and release approvals.
- Attach one versioned proof record to the feature or release item with device, installed build, host, action, result, owner, and release boundary. If a hop is missing, block the installed-path milestone and name the exact hop. Scope any source-only closeout to source delivery and link the open installed-path acceptance.
- If anything is unproven, unseen or not rolled out, do not run \`tracker done\`: flag it if Daniel must decide; otherwise note what is left and leave the item open or blocked.
- In a bug-fix loop, the done note shows the \`siblings\` and \`verify\` steps as complete, or lists each as skipped with the reason.`;
