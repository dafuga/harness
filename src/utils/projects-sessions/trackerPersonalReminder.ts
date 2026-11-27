// @harness-uid u_2lqdb7qyy3
import { trackerRepeatLabel } from './trackerRepeatLabel';
import { trackerPersonalAgent } from './trackerUnattendedHold';
import type { TrackerReminderSource, TrackerReminderTime } from './trackerPersonalReminder.types';

/** When an active personal item reminds next, or nothing for any other item. */
export function trackerPersonalReminder(
	item: TrackerReminderSource
): TrackerReminderTime | undefined {
	const { agent, status, remindAt, every } = item;
	const at = Date.parse(remindAt ?? '');
	if (!trackerPersonalAgent(agent) || status === 'done' || status === 'ignored') return undefined;
	return Number.isNaN(at)
		? undefined
		: { at: new Date(at).toISOString(), repeats: trackerRepeatLabel(every) };
}

/** Drops a leading "Reminder Sat 10:00:" label: a reminder list already shows what and when. */
export function trackerReminderName(title: string): string {
	const label =
		/^\s*(?:(?:daily|weekly|monthly)\s+)?(?:personal\s+)?remind(?:er)?\b(?:[^:]|:(?=\d))*:\s+/i;
	const text = title.replace(label, '').trim() || title;
	return text.charAt(0).toUpperCase() + text.slice(1);
}
