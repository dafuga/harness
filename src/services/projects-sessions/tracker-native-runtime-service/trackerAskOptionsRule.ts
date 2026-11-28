// @harness-uid u_77k5lqnq26
// @harness-uid u_4sk0pt1rul
export const trackerQuestionRoutingRule = `Send tool or process questions to Chief of Staff first with \`tracker alert <id> "<question>"\`. This includes how to use Tracker, which command to run, or how to apply a scope Daniel already approved.

Every draft ask awaits Chief of Staff review. Tracker sends session flags, alerts and blocks waiting on Daniel to Chief of Staff. Tracker plumbing stays in that inbox. An answer from Chief of Staff goes back to the session. Daniel only receives released decisions, flags from Chief of Staff, and decisions he creates himself. Daniel-facing delivery waits from 22:00 to 08:00 Lisbon. The one urgent fallback names only the size of the stalled review queue.

Use \`tracker flag\` when you believe Daniel has a decision to make. Write the question in plain English and say what you want to do and why in one sentence. Leave out internal command or field names such as "move-on", "launched run", and "next-step record". Include run numbers or commit SHAs only when Daniel needs them to decide.`;

export const trackerAskOptionsRule = `## Asking Daniel

${trackerQuestionRoutingRule}

After release, Daniel answers from Tracker, Hub, Mac and iOS by tapping a choice. Draft questions with 2 to 4 choices and one recommendation.

\`tracker flag <id> "<the question>" --option "<label>=<what happens if chosen>" --option "<label>=<what happens>" --recommend <1-based number of the recommended option>\`

Add \`--confirm deploy|money|secret\` when a tap would deploy, spend money or touch a secret; those need a confirm step. Daniel can still write a free-text answer, so never make an option stand for "other". Keep labels under 80 characters. Do not put secrets in a question or option.

A spec review must attach the spec, so Daniel can read it behind "View spec" and answer there: add \`--spec <owner>/<repo>#<PR>:<path/to/spec.md>\` (pinned to the PR head, or add \`@<commit>\`); the CLI refuses it otherwise. Attach other reading with \`--doc <file.md>\` and a design canvas with \`--design <https url>\`. The text is copied when you flag, so flag again after changing the spec.

The CLI refuses a flag without choices and a recommendation. A refused flag is saved for Chief of Staff and still exits non-zero. Scripts and monitors never ask with \`flag\`: they report with \`tracker alert <id> "<message>"\` and must treat a non-zero exit as undelivered. Waiting on another item, a computer or a session is not a question: record it with \`tracker block <id> "waiting on <item>"\`.

Chief of Staff reads the native queue with \`tracker review [id] --by "Chief of Staff"\`. Answer with \`tracker answer <id> "<answer>" --by "Chief of Staff"\` or release a plain-language decision with \`tracker release <id> "<question>" --option "<label>=<effect>" --option "<label>=<effect>" --recommend N --by "Chief of Staff"\`. Release supports the same confirmation and attachment options as flag.`;
