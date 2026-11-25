// @harness-uid u_r7qgepnoax
import type {
	TrackerBlocker,
	TrackerBlockerInbox
} from '../../../repositories/projects-sessions/TrackerItemReadRepository.types';
import type { NativeTrackerBlockerSync } from './nativeTrackerCli.types';

/** Render the Blockers inbox grouped by type: the exact action, who it routes to and its age. */
export function formatNativeTrackerBlockers(data: TrackerBlockerInbox | NativeTrackerBlockerSync) {
	const sync = 'blockers' in data ? data : undefined;
	const inbox = sync ? sync.blockers : (data as TrackerBlockerInbox);
	const lines = [
		`Blockers: ${inbox.total} (${inbox.unescalated} not yet on Needs Daniel, ${inbox.stale} stale)`
	];
	if (sync)
		lines.push(`  synced: escalated ${sync.escalated.length}, rechecked ${sync.rechecked.length}`);
	for (const group of inbox.groups) {
		lines.push(`${group.label.toUpperCase()} (${group.items.length})`);
		for (const blocker of group.items) lines.push(...formatBlocker(blocker));
	}
	return lines.join('\n');
}

function formatBlocker(blocker: TrackerBlocker): string[] {
	const flags = [
		blocker.kind === 'note' && 'reported in notes',
		blocker.needs_escalation && 'NOT ON NEEDS DANIEL',
		blocker.escalated && 'on Needs Daniel',
		blocker.duplicates.length && `+${blocker.duplicates.length} duplicate`
	].filter(Boolean);
	const lines = [
		`  - [${blocker.id.slice(0, 6)}] ${blocker.title} - ${blocker.action}`,
		`      ${[
			age(blocker.age_minutes),
			`route ${blocker.route}${blocker.route_to ? ` -> ${blocker.route_to}` : ''}`,
			blocker.owner && `owner ${blocker.owner}`,
			...flags
		]
			.filter(Boolean)
			.join(' · ')}`
	];
	if (blocker.recheck) lines.push(`      recheck: ${blocker.recheck}`);
	return lines;
}

function age(minutes: number): string {
	if (minutes < 60) return `${minutes}m`;
	if (minutes < 2880) return `${Math.floor(minutes / 60)}h`;
	return `${Math.floor(minutes / 1440)}d`;
}
