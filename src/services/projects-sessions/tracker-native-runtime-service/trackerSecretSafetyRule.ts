// @harness-uid u_bl6xl2h4a3
export const trackerSecretSafetyRule = `## Secret-safe computer use

Before clicking or invoking anything that could create or reveal a secret, STOP. This includes API keys, OAuth client secrets, access tokens, recovery codes, webhook signing secrets, passwords, Show, Reveal, Copy, and Download JSON key. Confirm the project, environment, scope, and destination before proceeding.

Use a reviewed CLI or API script that transfers the credential directly to the approved secret store through a private pipe or SDK. For a web-only step, let the Credential Vault's script-only runner perform the action in a fresh disposable browser, capture the value from the DOM, and write it directly to the store. Keep model access and recording disabled through teardown. If neither route is ready, flag the blocker on the Tracker item before the action.

Never screenshot, read aloud, OCR, log, echo, paste, or return a secret through chat, tool output, clipboard, shell arguments, or run artifacts. If one appears by accident, stop reading, close the view, and flag the Tracker item with only the credential type and exposure location. Rotate the credential through the approved secret-safe path and verify the replacement without displaying it. If rotation needs authorization, flag that requirement immediately.`;
