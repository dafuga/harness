// @harness-uid u_r7qgepnoax
import { trackerClaudeSessionId } from '../../../utils/projects-sessions/trackerClaudeSessionId';
import type {
	NativeTrackerItem,
	NativeTrackerListedRun,
	NativeTrackerPick,
	NativeTrackerRunRead,
	NativeTrackerRunReport
} from './nativeTrackerCli.types';
import { trackerFlagKind } from '../../../utils/projects-sessions/trackerStructuredAsk';

export function formatNativeTrackerItem(item: NativeTrackerItem): string {
	const flags = [
		itemStatus(item),
		item.review_status ?? flagLabel(item),
		item.resolved && 'resolved',
		item.chased_count && `CHASED ×${item.chased_count}`
	].filter(Boolean);
	const meta = trackerItemMetadata(item);
	return `[${item.id.slice(0, 6)}] ${item.title}  (${flags.join(', ')}; ${meta.join(' | ')})`;
}

const flagLabels = {
	ask: 'NEEDS DANIEL',
	ping: 'PING for Chief of Staff',
	'needs-options': 'NEEDS OPTIONS (Chief of Staff; not shown to Daniel)'
};

function flagLabel(item: NativeTrackerItem) {
	const kind = trackerFlagKind(item);
	return kind && flagLabels[kind];
}

function trackerItemMetadata(item: NativeTrackerItem) {
	return [
		item.kind,
		item.stage,
		item.priority && `priority ${item.priority}`,
		item.every && `every '${item.every}' ${item.every_tz}`,
		item.due && `${item.every ? 'next' : 'due'} ${item.due}`,
		item.remind_at && `reminder ${item.remind_at}`,
		item.owner && `owner ${item.owner}`,
		item.agent && `agent ${item.agent}`,
		item.auto && 'auto-launch',
		...trackerFollowThroughMetadata(item)
	].filter(Boolean);
}

function trackerFollowThroughMetadata(item: NativeTrackerItem) {
	return [
		item.next_step && `next step: ${item.next_step}`,
		item.parked_until && `parked until ${item.parked_until}`,
		item.chased_at && `chased ${item.chased_at}`,
		item.chased_by && `by ${item.chased_by}`,
		item.chased_reason
	];
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
	['chase', 'chased: '],
	['answer', 'resolved: '],
	['resolve', 'resolved: '],
	['update', 'updated '],
	['unlaunch', 'auto-launch off: '],
	['reject', 'rejected: ']
]);

export function nativeItemSuffix(command: string, item: NativeTrackerItem) {
	const run = item.rejected_run;
	if (command !== 'reject') return '';
	return run
		? `\n  run ${run.id} (${run.rung}) now counts as a failure`
		: '\n  (no auto-run to charge it to)';
}

export function nativeItemPrefix(
	command: string,
	first: string | undefined,
	item: NativeTrackerItem
) {
	if (command === 'launch')
		return first === 'on' || first === 'off' ? `due launch ${first}: ` : 'launch: ';
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
		claudeResumeHint(run),
		run.idle_nudges ? `  idle nudges: ${run.idle_nudges}` : ''
	].join('');
}

/** Only runs launched with a derived session id have a session name. */
function claudeResumeHint({ cli, session_name, session_id }: NativeTrackerListedRun) {
	const id = cli === 'claude' && session_name && trackerClaudeSessionId(session_id ?? '');
	return id ? `  claude session ${id}` : '';
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
