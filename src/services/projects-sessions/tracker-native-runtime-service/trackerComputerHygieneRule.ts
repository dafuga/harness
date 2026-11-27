// @harness-uid u_urrxsypdng
export const trackerComputerHygieneRule = `## Computer hygiene

Read the built-in \`computer-hygiene\` skill before using a browser, app, simulator, container or background process (\`harness hygiene skills computer-hygiene\`). For managed host resources, create them with \`harness hygiene tab\`, \`window\`, \`simulator\`, \`container\` or \`process -- <foreground command>\`. Use \`harness hygiene close <resource-id>\` as soon as a resource is no longer needed. Tracker also reaps recorded resources when the worker exits, is stopped or reaches its run limit. A Docker guest should use only its own isolated tools and resources.

Keep a list of any resources that had to be opened outside those commands, close them yourself when finished, and report anything still open in the Tracker note. Do not read, snapshot, switch, or close Daniel’s browser tabs or windows. Run browser tests in a browser and profile that the test launched, then close it in teardown. Never quit shared apps, close another run’s resources, or stop a shared dev server. For UI changes, also read the built-in \`design-patterns\` skill.`;
