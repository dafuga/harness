# Feature: Hosted Workspace

## Overview

The hosted app shows the Harness workspace of shared projects in a browser. People sign in with Google, read the projects they belong to, leave human comments and, as owners, invite others. It reuses the desktop components and store through a browser bridge that talks to the same-origin API. It runs no agent.

## Acceptance Criteria

- Sign-in uses the Google Identity Services script from `https://accounts.google.com/gsi/client` with the nonce of a fresh challenge. The credential and the CSRF value are posted in a request body; no credential is put in a URL.
- When sign-in is not configured the page says so and offers no substitute login. Signed in without projects, it explains that an owner connects a GitHub repository or sends an invitation.
- The project switcher lists the projects the API returns. It offers no local project.
- Collection and individual-project API routing retain the same authentication, validation and response behavior while staying within the controller complexity limit.
- Workspace links are `/projects/{projectId}/harness/branch/{encodedBranch}/...`, with `/commit/{fullSha}` for a pinned commit.
- The bridge reads `snapshot`, `entity`, `source`, `image` and `threads` under `/api/projects/{id}` and returns the desktop models; image bytes are a `Uint8Array`.
- A comment is posted without an author: the server binds the signed-in person. The answer is shown with the collaboration commit that acknowledged it.
- The hosted workspace shows no provider, model, effort, Plan, Change, approval or new-plan control. The bridge refuses those operations and never calls a run, plan or approval endpoint.
- Changing project leaves no entity, thread or image of the previous project on the page, and later requests use the new project's address.
- An owner sees members, creates an invitation and copies its link and its code separately. The page states that no email is sent.
- The invitation page asks for Google sign-in and the code, accepts it once and opens the project.
- `/native/{handoffId}` asks for sign-in, names what the desktop app asks to read before anything can be approved, and sends the typed code in a body. The code is never part of an address, and nothing is offered inside a frame or for an expired request.
- A read the server refuses is told to the workspace before it rejects: the session for 401, the one project for 403. Further history pages are read for the shown project, entity, commit and branch.
- A Google account whose address Google does not vouch for is pending, not signed in: the page shows that address, sends a code only when asked, takes the typed eight-digit code in a body and offers Cancel. Until the server names a signed-in person no project, member or approval page is read, and a deployment that cannot send email says so.
- Creating a project sends a name and a repository the server listed for the connected owner; the page states that the server checks the access again, and links to the GitHub connection.

## Verification Evidence

- `test/utils/browser-bridge.test.ts`: addresses, query values, refused agent operations without a request, closed capabilities, comment body, image bytes.
- `test/utils/browser-api.test.ts`, `browser-api-refusal.test.ts`, `browser-error.test.ts`: same-origin requests, bodies, coded failures, an ended session.
- `test/utils/browser-auth.test.ts`, `google-button.test.ts`, `test/stores/session.test.ts`: challenge, nonce, credential post, status.
- `test/utils/browser-projects.test.ts`: project, member and invitation addresses; a link without the code.
- `tests/e2e/hosted-workspace.spec.ts`: absent agent controls, a comment without a run, a historical comment, project isolation, a viewer, a signed-out visitor.
- `tests/e2e/hosted-access.spec.ts`: unconfigured and signed-out states, the Google button with its nonce, an empty project list, project creation, an invitation link and code, invitation acceptance.

- `tests/e2e/hosted-native.spec.ts`, `test/utils/native-scope.test.ts`, `test/utils/browser-bridge-history.test.ts`: the approval page, the named scope, history addresses and refusal events.

- `tests/e2e/hosted-email.spec.ts`, `test/utils/browser-auth-email.test.ts`, `test/stores/session-email.test.ts`: the pending address, a wrong and a right code, Cancel, pages closed while pending, missing delivery.

The browser tests answer the API and Google's script with fixtures inside the test; no fixture is part of the built app. They prove the pages against that fixture, not against the deployed server, a real Google account or a real GitHub repository.

## Future Enhancements

- Removing a member and listing open invitations once the API exposes them.
- Disconnecting GitHub from the page.
