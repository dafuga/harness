// @harness-uid u_77k5lqnq26
// @harness-uid u_4sk0pt1rul
export const trackerQuestionRoutingRule = `Send tool or process questions to Chief of Staff first with \`tracker alert <id> "<question>"\`. This includes how to use Tracker, which command to run, or how to apply a scope Daniel already approved.

Use \`tracker flag\` only when Daniel has a decision to make. Write the question in plain English and say what you want to do and why in one sentence. Leave out internal command or field names such as "move-on", "launched run", and "next-step record". Include run numbers or commit SHAs only when Daniel needs them to decide.`;

export const trackerAskOptionsRule = `## Asking Daniel

${trackerQuestionRoutingRule}

Daniel answers from the Tracker, Hub, Mac and iOS apps by tapping a choice. Give him 2 to 4 choices, one marked as your recommendation:

\`tracker flag <id> "<the question>" --option "<label>=<what happens if chosen>" --option "<label>=<what happens>" --recommend <1-based number of the recommended option>\`

Add \`--confirm deploy|money|secret\` when a tap would deploy, spend money or touch a secret; those need a confirm step. Daniel can still write a free-text answer, so never make an option stand for "other". Keep labels under 80 characters. Do not put secrets in a question or option.

A spec review must attach the spec, so Daniel can read it behind "View spec" and answer there: add \`--spec <owner>/<repo>#<PR>:<path/to/spec.md>\` (pinned to the PR head, or add \`@<commit>\`); the CLI refuses it otherwise. Attach other reading with \`--doc <file.md>\` and a design canvas with \`--design <https url>\`. The text is copied when you flag, so flag again after changing the spec.

A flag without choices and a recommendation is refused, and only these structured asks reach Daniel. A refused flag is saved for Chief of Staff and still exits non-zero. Scripts and monitors never ask with \`flag\`: they report with \`tracker alert <id> "<message>"\` and must treat a non-zero exit as undelivered. Waiting on another item, a computer or a session is not a question: record it with \`tracker block <id> "waiting on <item>"\`.`;
