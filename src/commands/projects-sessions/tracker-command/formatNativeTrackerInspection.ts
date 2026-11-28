// @harness-uid u_r7qgepnoax
import type { TrackerAdapterPollResult } from '../../../services/projects-sessions/TrackerAdapterPollService.types';
import type { TrackerPlacement } from '../../../utils/projects-sessions/trackerMachine.types';
import {
	formatNativeTrackerMachines,
	formatNativeTrackerPlacement
} from './formatNativeTrackerMachines';
import type { NativeTrackerMachines } from './formatNativeTrackerMachines.types';
import { formatListedRun, formatNativeTrackerItem } from './formatNativeTrackerItem';
import { formatNativeTrackerAlert } from './formatNativeTrackerAlert';
import type {
	NativeTrackerAdapter,
	NativeTrackerAdapterChange,
	NativeTrackerAdapterReply,
	NativeTrackerAlertReceipt,
	NativeTrackerBackupList,
	NativeTrackerInspection,
	NativeTrackerItemDetail
} from './nativeTrackerCli.types';

/** Commands whose reply prints as JSON even without --json. */
export const nativeJsonCommands = new Set([
	'status',
	'autolaunch',
	'watchdog',
	'needs-attention',
	'review'
]);

export function formatNativeTrackerInspection(command: string, data: NativeTrackerInspection) {
	switch (command) {
		case 'machines':
			return formatNativeTrackerMachines(data as unknown as NativeTrackerMachines);
		case 'place':
			return formatNativeTrackerPlacement(data as unknown as TrackerPlacement);
		case 'alert':
			return formatNativeTrackerAlert(data as unknown as NativeTrackerAlertReceipt);
		case 'show':
			return formatItemDetail(data as NativeTrackerItemDetail);
		case 'adapter':
			return (
				(data as NativeTrackerAdapter[]).map(formatAdapter).join('\n') || 'No adapters configured.'
			);
		case 'backup':
			return formatBackupList(data as NativeTrackerBackupList);
		default:
			return undefined;
	}
}

function formatItemDetail(item: NativeTrackerItemDetail): string {
	const lines = [formatNativeTrackerItem(item), `  id: ${item.id}`];
	lines.push(...itemNotes(item));
	if (item.callback) lines.push(`  callback: ${item.callback.target} on ${item.callback.node}`);
	lines.push(...recurringDetails(item), ...launchDetails(item));
	for (const run of item.runs ?? []) lines.push(`  run ${formatListedRun(run)}`);
	lines.push(`  created ${item.created_at} on ${item.created_by}; updated ${item.updated_at}`);
	return lines.join('\n');
}

function itemNotes(item: NativeTrackerItemDetail): string[] {
	const lines: string[] = [];
	for (const promotion of item.planning?.promotions ?? [])
		lines.push(`  promoted to ${promotion.stage} by ${promotion.by} at ${promotion.at}`);
	if (item.parent) lines.push(`  parent: ${item.parent}`);
	if (item.question) lines.push(`  question: ${item.question}`);
	lines.push(...optionLines(item));
	if (item.answer)
		lines.push(`  answer: ${item.answer} (by ${item.answered_by} at ${item.answered_at})`);
	if (item.notes) lines.push(`  notes: ${item.notes}`);
	for (const n of item.notes_log ?? []) lines.push(`  note ${n.at} [${n.node}]: ${n.text}`);
	return lines;
}

function optionLines(item: NativeTrackerItemDetail): string[] {
	const lines = (item.options ?? []).map((option, index) => {
		const mark = option.recommended ? ' (recommended)' : '';
		return `  option ${index + 1}${mark}: ${option.label}${option.effect ? ` - ${option.effect}` : ''}`;
	});
	if (item.confirm) lines.push(`  confirm step required: ${item.confirm}`);
	return lines;
}

function recurringDetails(item: NativeTrackerItemDetail): string[] {
	if (!item.every) return [];
	const lines = [
		`  recurring: every '${item.every}' (${item.every_tz}); next ${item.due ?? '(computed by the hub)'}`
	];
	if (item.occurrence) lines.push(`  last occurrence: ${item.occurrence}`);
	const result = item.last_result;
	if (result)
		lines.push(
			`  last result: ${result.status} for ${result.occurrence}${result.note ? ` - ${result.note}` : ''}`
		);
	if (item.missed) lines.push(`  last missed: ${item.missed}`);
	return lines;
}

function launchDetails(item: NativeTrackerItemDetail): string[] {
	const schedule =
		item.schedule_preview === undefined ? item.schedule_status : item.schedule_preview;
	const mode = launchMode(item, schedule ?? item.schedule_status);
	const fields = launchSettings(item);
	const lines: string[] = [];
	if (mode !== 'off' || fields.length) lines.push('  auto-launch: ' + [mode, ...fields].join('; '));
	if (schedule) lines.push(`  due scheduler: ${schedule}`);
	if (item.launch_status?.computer)
		lines.push(`  launch on ${item.launch_status.computer}: ${item.launch_status.reason}`);
	return lines;
}

function launchMode(item: NativeTrackerItemDetail, schedule?: string | null): string {
	if (item.auto) return 'on';
	if (item.status === 'open' && item.kind === 'task' && item.due && !item.schedule_off && schedule)
		return 'pending (due scheduler)';
	return 'off';
}

function launchSettings(item: NativeTrackerItemDetail): string[] {
	const { project, repo, model } = item;
	const computer = item.auto && item.launch_target ? item.launch_target : item.computer;
	const fields = Object.entries({ project, repo, computer, model })
		.filter(([, value]) => Boolean(value))
		.map(([key, value]) => `${key} ${value}`);
	if (item.sensitive) fields.push('sensitive');
	return fields;
}

function formatAdapter(source: NativeTrackerAdapter): string {
	const runner = source.runner ? ` on ${source.runner}` : '';
	const error = source.last_error ? ` [${source.last_error}]` : '';
	return `${source.id} → ${source.agent} (${source.paused ? 'paused' : 'enabled'})${runner}${error}`;
}

function formatBackupList({ status, files }: NativeTrackerBackupList): string {
	const rows = files.map(
		({ kind, name, size, mtime }) =>
			`  ${kind.padEnd(13)} ${name.padEnd(36)} ${String(size).padStart(9)}  ${mtime}`
	);
	const head = status.enabled
		? `backups: ${status.schedule}\n  last ok ${status.last_ok ?? 'never'}${status.stale ? ' (STALE)' : ''}` +
			(status.last_error ? `\n  last error ${status.last_error}` : '')
		: status.note;
	return [head, ...(rows.length ? rows : ['  (no backups yet)'])].join('\n');
}

export function formatNativeTrackerAdapterReply(reply: NativeTrackerAdapterReply): string {
	return 'actions' in reply
		? formatNativeTrackerAdapterRun(reply)
		: formatNativeTrackerAdapterChange(reply);
}

function formatNativeTrackerAdapterChange(change: NativeTrackerAdapterChange): string {
	if (change.removed) return `Removed ${change.id}`;
	if (change.enabled_at !== undefined)
		return `Enabled ${change.id} at ${new Date(change.enabled_at).toISOString()}`;
	return `${change.id} is ${change.paused ? 'paused' : 'enabled'}`;
}

function formatNativeTrackerAdapterRun(
	result: Extract<TrackerAdapterPollResult, { status: 'polled' }>
): string {
	const lines = result.actions.map(({ action, title, url, item_id, auto_launch }) => {
		const verb =
			action === 'covered'
				? 'already covered'
				: [result.dry_run ? 'would' : '', action].filter(Boolean).join(' ');
		const link = item_id && action !== 'create' ? ` → ${item_id.slice(0, 6)}` : '';
		const due = auto_launch ? ' [due for auto-launch]' : '';
		return `${verb} ${title} (${url})${link}${due}`;
	});
	return lines.join('\n') || 'No items to create or link.';
}
