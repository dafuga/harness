// @harness-uid u_r7qgepnoax
import type {
	NativeTrackerItem,
	NativeTrackerListedRun,
	NativeTrackerPick,
	NativeTrackerRunRead,
	NativeTrackerRunReport
} from './nativeTrackerCli.types';

export function formatNativeTrackerItem(item: NativeTrackerItem): string {
	const flags = [
		itemStatus(item),
		item.needs_daniel && !item.resolved && 'NEEDS DANIEL',
		item.resolved && 'resolved'
	].filter(Boolean);
	const meta = trackerItemMetadata(item);
	return `[${item.id.slice(0, 6)}] ${item.title}  (${flags.join(', ')}; ${meta.join(' | ')})`;
}

function trackerItemMetadata(item: NativeTrackerItem) {
	return [
		item.kind,
		item.every && `every '${item.every}' ${item.every_tz}`,
		item.due && `${item.every ? 'next' : 'due'} ${item.due}`,
		item.remind_at && `reminder ${item.remind_at}`,
		item.owner && `owner ${item.owner}`,
		item.agent && `agent ${item.agent}`,
		item.auto && 'auto-launch'
	].filter(Boolean);
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
	['ignore', 'ignored: '],
	['unignore', 'unignored: '],
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

export function formatNativeTrackerRunRead(
	command: string,
	data: NativeTrackerRunRead
): string | undefined {
	switch (command) {
		case 'runs':
			return (data as NativeTrackerListedRun[]).map(formatListedRun).join('\n') || '(no runs)';
		case 'models':
			return formatRunReport(data as NativeTrackerRunReport);
		case 'pick':
			return formatModelPick(data as NativeTrackerPick);
		default:
			return undefined;
	}
}

export function formatListedRun(run: NativeTrackerListedRun): string {
	const stamp = (ms?: number | null) => (ms ? new Date(ms).toISOString() : '-');
	const session = run.session_name
		? `  ${run.session_name}${run.tmux ? ` (tmux ${run.tmux})` : ''}`
		: '';
	return [
		`#${run.id} [${run.item_id.slice(0, 6)}] ${run.node || '?'} ${run.model}`,
		run.effort ? `:${run.effort}` : '',
		` try ${run.attempt}  ${run.state}`,
		run.outcome ? `/${run.outcome}` : '',
		`  ${stamp(run.started_at)} → ${stamp(run.ended_at)}`,
		run.cost_usd == null ? '' : ` $${run.cost_usd.toFixed(2)}`,
		run.failure_reason ? ` - ${run.failure_reason}` : '',
		run.redone_by ? ` (redone by ${run.redone_by})` : '',
		session,
		run.idle_nudges ? `  idle nudges: ${run.idle_nudges}` : ''
	].join('');
}

function formatModelPick(pick: NativeTrackerPick): string {
	const effort = pick.effort ? ` ${pick.effort}` : '';
	const pin = pick.pinned ? ' - named on the item' : '';
	const computer = pick.computer ? `\n  computer: ${pick.computer}` : '';
	return `${pick.rung} (${pick.model}${effort}, ${pick.cli})${pin}\n  ${pick.reason}${computer}`;
}

function formatRunReport({ ladder, rows }: NativeTrackerRunReport): string {
	if (!rows.length) return '(no finished runs yet)';
	const order = (rung: string) => (ladder.includes(rung) ? ladder.indexOf(rung) : 99);
	const sorted = [...rows].sort(
		(a, b) => order(a.rung) - order(b.rung) || compareReportKinds(a.kind, b.kind)
	);
	const heading =
		'rung     kind        runs  done  fail  blkd  success  redone   costed           avg cost        cost/success  avg min  nudges';
	return [
		heading,
		...sorted.map(formatRunReportRow),
		'',
		'success = done / (done + failed + rejected + timed out); blocked-on-Daniel runs are neutral.',
		'Cost is an API-equivalent estimate. Costed counts runs with a saved estimate or a quote from retained usage.'
	].join('\n');
}

function compareReportKinds(a: string, b: string): number {
	if (a === b) return 0;
	if (a === '*') return -1;
	if (b === '*') return 1;
	return a.localeCompare(b);
}

function formatRunReportRow(row: NativeTrackerRunReport['rows'][number]): string {
	const usd = (value: number | null, range: [number, number] | null) => {
		if (range) return range.map((bound) => `$${bound.toFixed(2)}`).join('–');
		return value == null ? '-' : `$${value.toFixed(2)}`;
	};
	const success = row.success_rate == null ? '-' : `${Math.round(row.success_rate * 100)}%`;
	return [
		row.rung.padEnd(8),
		(row.kind === '*' ? 'ALL' : row.kind).padEnd(10),
		String(row.runs).padStart(5),
		String(row.done).padStart(5),
		String(row.failed).padStart(5),
		String(row.blocked).padStart(5),
		success.padStart(8),
		String(row.redone).padStart(7),
		`${row.priced + (row.ranged ?? 0)}/${row.runs}`.padStart(8),
		usd(row.avg_cost_usd, row.avg_cost_range_usd).padStart(18),
		usd(row.cost_per_success_usd, row.cost_per_success_range_usd).padStart(19),
		(row.avg_minutes == null ? '-' : row.avg_minutes.toFixed(0)).padStart(8),
		String(row.idle_nudges).padStart(7)
	].join(' ');
}
