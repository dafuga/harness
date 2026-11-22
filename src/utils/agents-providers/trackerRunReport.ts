// @harness-uid u_lst54o5ptr
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
		accumulate(groups, row, row.kind ?? '?');
		accumulate(groups, row, '*');
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
		tokens: 0,
		ms: 0
	};
}

function accumulate(
	groups: Map<string, ReturnType<typeof reportGroup>>,
	row: TrackerRunRow,
	kind: string
) {
	const key = JSON.stringify([row.rung, kind]);
	const group = groups.get(key) ?? reportGroup(row.rung, kind);
	group.runs++;
	group[reportOutcome(row.outcome)]++;
	group.redone += Number(row.redone_by != null);
	group.idle_nudges += row.idle_nudges ?? 0;
	group.cost += row.cost_usd ?? 0;
	group.priced += Number(row.cost_usd != null);
	group.tokens +=
		(row.input_tokens ?? 0) +
		(row.output_tokens ?? 0) +
		(row.cache_read_tokens ?? 0) +
		(row.cache_write_tokens ?? 0);
	// Keep the legacy report's arithmetic. Shared records require measured timing.
	group.ms += (row.ended_at ?? 0) - (row.started_at ?? 0);
	groups.set(key, group);
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
	return {
		...group,
		success_rate: decided ? group.done / decided : null,
		avg_cost_usd: group.priced ? group.cost / group.priced : null,
		cost_per_success_usd: group.priced && group.done ? group.cost / group.done : null,
		avg_minutes: group.ms / group.runs / 60_000
	};
}
