// @harness-uid u_umjvzneh5k
import type { TrackerItemRecord } from '../project-overview/projectOverviewTracker.types';
import { homeText } from './homeTrackerText';

/** Notes the Tracker or Hub writes about an item, not progress its owner reported. */
const automatedNote =
	/^(watchdog|auto-launch|launch |unblocked|hub message:|due scheduler|stopped: watchdog)/i;

const longest = 240;

/** A sanitized line that fits the row; a longer one ends at a whole word with an ellipsis. */
function line(value: string | null | undefined): string | null {
	const text = homeText(value, Number.MAX_SAFE_INTEGER);
	if (!text || text.length <= longest) return text;
	const cut = text.slice(0, longest);
	const word = cut.lastIndexOf(' ');
	return `${cut.slice(0, word > 0 ? word : longest - 1)}…`;
}

/**
 * @pure Where a piece of work really is: why it is blocked, or the latest milestone its owner
 * noted. Planning stages stay at their default for most items, so they cannot say this.
 */
export function homeWorkNow(item: TrackerItemRecord): string | null {
	if (item.status === 'blocked') {
		const reason = line(item.blocked_reason ?? item.question);
		if (reason) return `Blocked: ${reason}`;
	}
	const notes = item.notes_log ?? [];
	for (let index = notes.length - 1; index >= 0; index -= 1) {
		const text = notes[index]?.text.trim();
		if (text && !automatedNote.test(text) && !text.startsWith('Area claim on '))
			return line([item.area_claim, text].filter(Boolean).join(' · '));
	}
	return line(item.area_claim);
}
