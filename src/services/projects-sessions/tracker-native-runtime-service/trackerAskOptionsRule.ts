// @harness-uid u_77k5lqnq26
// @harness-uid u_4sk0pt1rul
export const trackerAskOptionsRule = `## Asking Daniel

Daniel answers from the Tracker, Hub, Mac and iOS apps by tapping a choice. Whenever you ask a question or hit a blocker, give 2 to 4 choices, one marked as your recommendation:

\`tracker flag <id> "<the question>" --option "<label>=<what happens if chosen>" --option "<label>=<what happens>" --recommend <1-based number of the recommended option>\`

Add \`--confirm deploy|money|secret\` when a tap would deploy, spend money or touch a secret; those need a confirm step. Daniel can still write a free-text answer, so never make an option stand for "other". Keep labels under 80 characters. Do not put secrets in a question or option.

A flag without choices and a recommendation is refused, and only these structured asks reach Daniel. Waiting on another item, a computer or a session is not a question: record it with \`tracker block <id> "waiting on <item>"\`.`;
