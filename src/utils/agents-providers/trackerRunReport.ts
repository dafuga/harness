// @harness-uid u_lst54o5ptr
import { trackerRunCost } from '../../services/agents-providers/module-task-analytics-service/trackerRunRecords';
import type { TaskApiCost } from '../../repositories/agents-providers/ModuleTaskRepository.types';
import type { TrackerModelHistory } from './pickTrackerModel.types';
import type { TrackerHistoryScope, TrackerRunRow } from './trackerRunReport.types';

function reportOutcome(outcome: TrackerRunRow['outcome']) {
	if (outcome === 'done' || outcome === 'blocked') return outcome;
	if (outcome === 'failed' || outcome === 'rejected' || outcome === 'timed_out') return 'failed';
	return 'other';
}

export function trackerModelHistory(
	rows: readonly TrackerRunRow[],
	scope: TrackerHistoryScope,
	minSamples = 3
): TrackerModelHistory {
	const { kind, project } = scope;
	const eligible = rows.filter((row) => row.state === 'finished' && !row.pinned);
	const scopes = [
		kind && project && ((row: TrackerRunRow) => row.kind === kind && row.project === project),
		kind && ((row: TrackerRunRow) => row.kind === kind),
		project && ((row: TrackerRunRow) => row.project === project)
	];
	for (const matches of scopes) {
		if (!matches) continue;
		const history = summarizeOutcomes(eligible.filter(matches));
		if (Object.values(history).some(({ ok, fail }) => ok + fail >= minSamples)) return history;
	}
	return {};
}

function summarizeOutcomes(rows: readonly TrackerRunRow[]) {
	const groups = new Map<string, { ok: number; fail: number }>();
	for (const row of rows) {
		const counts = groups.get(row.rung) ?? { ok: 0, fail: 0 };
		const outcome = reportOutcome(row.outcome);
		if (outcome === 'done') counts.ok++;
		if (outcome === 'failed') counts.fail++;
		groups.set(row.rung, counts);
	}
	return Object.fromEntries(groups);
}

/** Roll up one snapshot of local and replicated attempts, keyed at source by node and run ID. */
export function trackerRunReport(rows: readonly TrackerRunRow[]) {
	const groups = new Map<string, ReturnType<typeof reportGroup>>();
	for (const row of rows) {
		if (row.state !== 'finished') continue;
		const metrics = { quote: trackerRunCost(row), duration: measuredDuration(row) };
		accumulate(groups, row, row.kind ?? '?', metrics);
		accumulate(groups, row, '*', metrics);
	}
	return [...groups.values()].sort(compareGroups).map(withAverages);
}

function reportGroup(rung: string, kind: string) {
	return {
		rung,
		kind,
		runs: 0,
		done: 0,
		failed: 0,
		blocked: 0,
		other: 0,
		redone: 0,
		idle_nudges: 0,
		cost: 0,
		priced: 0,
		ranged: 0,
		min_cost: 0,
		max_cost: 0,
		timed: 0,
		tokens: 0,
		ms: 0
	};
}

function accumulate(
	groups: Map<string, ReturnType<typeof reportGroup>>,
	row: TrackerRunRow,
	kind: string,
	{ quote, duration }: { quote: TaskApiCost; duration: number | null }
) {
	const key = JSON.stringify([row.rung, kind]);
	const group = groups.get(key) ?? reportGroup(row.rung, kind);
	group.runs++;
	group[reportOutcome(row.outcome)]++;
	group.redone += Number(row.redone_by != null);
	group.idle_nudges += row.idle_nudges ?? 0;
	group.cost += quote.usd ?? 0;
	group.priced += Number(quote.usd != null);
	group.ranged += Number(quote.usd == null && quote.minimumUsd != null && quote.maximumUsd != null);
	group.min_cost += quote.minimumUsd ?? 0;
	group.max_cost += quote.maximumUsd ?? 0;
	group.tokens +=
		(row.input_tokens ?? 0) +
		(row.output_tokens ?? 0) +
		(row.cache_read_tokens ?? 0) +
		(row.cache_write_tokens ?? 0);
	group.ms += duration ?? 0;
	group.timed += Number(duration !== null);
	groups.set(key, group);
}

function measuredDuration(row: TrackerRunRow): number | null {
	const { started_at: start, ended_at: end } = row;
	return start != null && end != null && end >= start ? end - start : null;
}

function compareGroups(
	a: ReturnType<typeof reportGroup>,
	b: ReturnType<typeof reportGroup>
): number {
	if (a.rung !== b.rung) return a.rung.localeCompare(b.rung);
	if (a.kind === '*') return -1;
	if (b.kind === '*') return 1;
	return a.kind.localeCompare(b.kind);
}

function withAverages(group: ReturnType<typeof reportGroup>) {
	const decided = group.done + group.failed;
	const costed = group.priced + group.ranged;
	const range = (divisor: number): [number, number] | null =>
		group.ranged && divisor ? [group.min_cost / divisor, group.max_cost / divisor] : null;
	return {
		...group,
		success_rate: decided ? group.done / decided : null,
		avg_cost_usd: costed && !group.ranged ? group.cost / costed : null,
		cost_per_success_usd: costed && group.done && !group.ranged ? group.cost / group.done : null,
		avg_cost_range_usd: range(costed),
		cost_per_success_range_usd: range(group.done),
		avg_minutes: group.timed ? group.ms / group.timed / 60_000 : null
	};
}
