// @harness-uid u_r7qgepnoax
import { trackerQuestionRoutingRule } from '../../../services/projects-sessions/tracker-native-runtime-service/trackerAskOptionsRule';
import type { TrackerInstructionsRepair } from './runTrackerInstructions.types';

const start = '<!-- tracker:start -->';
const end = '<!-- tracker:end -->';
const placeholder = '\u0000TRACKER_BLOCK\u0000';

/** The instructions every agent on a Tracker computer reads. Name only native commands here. */
export const trackerInstructionsBlock = `${start}
## Shared tracker

Daniel's work is tracked in the shared \`tracker\` CLI, which runs and syncs on every computer (the box, the primary Mac and MB2). On the Macs the CLI is \`~/.local/bin/tracker\` (add \`~/.local/bin\` to PATH if \`tracker\` isn't found). Run \`tracker help\` for all commands.

${trackerQuestionRoutingRule}

- **Starting work:** \`tracker start <id>\`. Ask your bot or brief for the id. If there isn't one, create it: \`tracker add "<task>" --owner "<your session name>" --agent <project>\`. Record your ETA as a due time (\`tracker update <id> --due <ISO time>\`) and update it if it slips.
- **At each meaningful milestone:** \`tracker note <id> "..."\`.
- **A decision only Daniel can make:** run \`tracker flag <id> "<the exact question>" --option "<label>=<what happens>" --option "<label>=<what happens>" --recommend <number>\` (2 to 4 options; add \`--confirm deploy|money|secret\` when a tap would deploy, spend money or touch a secret) at the moment you ask, in addition to writing it in your terminal.
- **Waiting on another item, computer or session** is not a question: \`tracker block <id> "waiting on <item>"\`.
- **Stopping, pausing, handing off, or out of quota:** before you stop, \`tracker note <id> "stopped: <why>; resume from: <state, branch, files>"\`.
- **When finished:** \`tracker done <id> --note "<result, PR link, tests run, deploy and rollback IDs>"\`.
- **Before raising something new,** check it isn't already tracked or ignored: \`tracker check "<topic>"\` (and \`tracker list --agent <project>\`). If Daniel has ignored it, don't raise it again.
- **Handing a task to a new session:** \`tracker launch <id>\` runs it through the tracker (\`tracker pick <id>\` shows the model choice). Don't start a session by hand for a tracker task unless Daniel named the model or computer.
- Never put secrets in tracker text. Never start a second tracker service. \`tracker ensure\` only checks that the service is ready; if \`tracker status\` fails, check the computer's service manager. Before promoting a replacement hub, verify the previous hub is stopped and cannot restart as hub, and preserve its final database and spoke queues.
${end}`;

/**
 * Leave exactly one canonical block in the text. A marker without its partner is removed as a
 * single line and the block takes its place. Text outside complete blocks is never removed.
 */
export function repairTrackerInstructions(source: string): TrackerInstructionsRepair {
	const original = source.replace(/\r\n/g, '\n');
	const blocks =
		/<!-- tracker:start -->(?:(?!<!-- tracker:start -->)[\s\S])*?<!-- tracker:end -->/g;
	let found = 0;
	const replaced = original.replace(blocks, () => (found++ === 0 ? placeholder : ''));
	const stray = removeStrayMarkers(replaced);
	const notes = [...(found > 1 ? [`collapsed ${found} blocks into one`] : []), ...stray.notes];
	if (!found && stray.startAt === undefined)
		notes.push(original.trim() ? 'added the block at the end' : 'created the block');
	const text = insertBlock(found ? stray.text : placeBlock(stray.text, stray.startAt));
	return { text, changed: text !== source, notes };
}

function removeStrayMarkers(text: string) {
	const notes: string[] = [];
	let startAt: number | undefined;
	const lines = text.split('\n').filter((line, index) => {
		const marker = line.trim();
		if (marker !== start && marker !== end) return true;
		const [kind, partner] = marker === start ? ['start', 'end'] : ['end', 'start'];
		notes.push(`removed a stray ${kind} marker with no ${partner} marker`);
		if (kind === 'start') startAt ??= index;
		return false;
	});
	return { text: lines.join('\n'), startAt, notes };
}

function placeBlock(text: string, startAt: number | undefined): string {
	if (startAt === undefined) return [text.trimEnd(), placeholder].filter(Boolean).join('\n\n');
	const lines = text.split('\n');
	lines.splice(startAt, 0, placeholder);
	return lines.join('\n');
}

/** One blank line separates the block from the text around it. */
function insertBlock(text: string): string {
	const [before, after = ''] = text.split(placeholder);
	const parts = [before.replace(/\n+$/, ''), trackerInstructionsBlock, after.replace(/^\n+/, '')];
	const joined = parts.filter(Boolean).join('\n\n');
	return joined.endsWith('\n') ? joined : `${joined}\n`;
}
