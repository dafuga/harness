// @harness-uid u_r7qgepnoax
import type { NativeTrackerItem } from './nativeTrackerCli.types';

export function formatNativeTrackerItem(item: NativeTrackerItem): string {
	const flags = [
		itemStatus(item),
		item.needs_daniel && !item.resolved && 'NEEDS DANIEL',
		item.resolved && 'resolved'
	].filter(Boolean);
	const meta = [
		item.kind,
		item.every && `every '${item.every}' ${item.every_tz}`,
		item.due && `${item.every ? 'next' : 'due'} ${item.due}`,
		item.owner && `owner ${item.owner}`,
		item.agent && `agent ${item.agent}`,
		item.auto && 'auto-launch'
	].filter(Boolean);
	return `[${item.id.slice(0, 6)}] ${item.title}  (${flags.join(', ')}; ${meta.join(' | ')})`;
}

function itemStatus(item: NativeTrackerItem): string {
	switch (item.status) {
		case 'in_progress':
			return 'IN PROGRESS';
		case 'done':
			return 'DONE';
		case 'blocked':
			return `BLOCKED: ${item.blocked_reason}`;
		case 'ignored':
			return `IGNORED: ${item.ignored_reason}${item.ignored_until ? ` (until ${item.ignored_until})` : ''}`;
		default:
			return 'open';
	}
}

const commandPrefixes = new Map([
	['add', 'added '],
	['plan', 'added '],
	['goal', 'added '],
	['note', 'noted: '],
	['flag', 'flagged: '],
	['answer', 'resolved: '],
	['resolve', 'resolved: '],
	['update', 'updated '],
	['unlaunch', 'auto-launch off: ']
]);

export function nativeItemPrefix(
	command: string,
	first: string | undefined,
	item: NativeTrackerItem
) {
	if (command === 'launch')
		return first === 'on' || first === 'off' ? `due launch ${first}: ` : 'auto-launch on: ';
	if (command === 'done' && item.last_result && item.every)
		return `occurrence ${item.last_result.occurrence} ${item.last_result.status}: `;
	return commandPrefixes.get(command) ?? `${command}: `;
}
