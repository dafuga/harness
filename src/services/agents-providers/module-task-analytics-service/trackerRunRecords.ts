// @harness-uid u_yqgzxyqdn5
import { createHash } from 'node:crypto';
import { createRunRecord } from './modelRunRecord';
import { estimateApiCost } from './modelRunPricing';
import type { RunRecord } from './modelRunRecord.types';
import type {
	TaskApiCost,
	TaskUsage
} from '../../../repositories/agents-providers/ModuleTaskRepository.types';
import type { TrackerRunRow } from '../../../utils/agents-providers/trackerRunReport.types';

/** Project finished Tracker attempts into the Harness v1 model-run contract. */
export function trackerRunRecords(rows: readonly TrackerRunRow[]): RunRecord[] {
	const history = new Map(rows.map((row) => [runId(row.node, row.id), row]));
	const records: RunRecord[] = [];
	for (const row of rows) {
		const { outcome, ended_at: endedAt } = row;
		if (row.state !== 'finished' || outcome == null || endedAt == null) continue;
		records.push(projectRun(row, history, { outcome, endedAt }));
	}
	return records;
}

function projectRun(
	row: TrackerRunRow,
	history: ReadonlyMap<string, TrackerRunRow>,
	{ outcome, endedAt }: { outcome: RunRecord['outcome']; endedAt: number }
): RunRecord {
	const usage = trackerUsage(row);
	return createRunRecord({
		source: 'tracker',
		id: runId(row.node, row.id),
		taskId: row.item_id,
		chainId: chainId(row),
		taskType: row.kind ?? '?',
		project: row.project ?? null,
		provider: row.cli,
		model: row.model,
		effort: row.effort ?? null,
		attempt: row.attempt ?? null,
		...historyFor(row, history),
		startedAt: row.started_at == null ? null : new Date(row.started_at).toISOString(),
		finishedAt: new Date(endedAt).toISOString(),
		outcome,
		usage,
		cost: trackerRunCost(row, usage)
	});
}

function runId(node: string, id: number): string {
	return JSON.stringify([node, id]);
}

function chainId(row: TrackerRunRow): string {
	// Launch tokens separate reruns of one item without exposing the token in the record.
	return createHash('sha256')
		.update(JSON.stringify([row.item_id, row.auto_token ?? null]))
		.digest('hex');
}

function historyFor(row: TrackerRunRow, history: ReadonlyMap<string, TrackerRunRow>) {
	let current = row;
	let escalations = 0;
	let rejectedBefore = false;
	while (current.escalated_from != null) {
		const previous = predecessor(current, history);
		if (!previous) return { escalations: null, rejectedBefore: rejectedBefore || null };
		if (changedModel(previous, current)) escalations++;
		if (previous.outcome === 'rejected') rejectedBefore = true;
		current = previous;
	}
	if (current.attempt !== 1) return { escalations: null, rejectedBefore: rejectedBefore || null };
	return { escalations, rejectedBefore };
}

function changedModel(previous: TrackerRunRow, current: TrackerRunRow): boolean {
	return previous.model !== current.model || (previous.effort ?? null) !== (current.effort ?? null);
}

function predecessor(row: TrackerRunRow, history: ReadonlyMap<string, TrackerRunRow>) {
	const id = row.escalated_from;
	if (id == null || id >= row.id) return undefined;
	const previous = history.get(runId(row.node, id));
	if (
		previous?.item_id === row.item_id &&
		(previous.auto_token ?? null) === (row.auto_token ?? null)
	)
		return previous;
	return undefined;
}

function trackerUsage(row: TrackerRunRow): TaskUsage {
	const { input_tokens: input, cache_read_tokens: read, cache_write_tokens: write } = row;
	return {
		inputTokens: input == null || read == null || write == null ? null : input + read + write,
		outputTokens: row.output_tokens ?? null,
		cacheReadTokens: read ?? null,
		cacheWriteTokens: write ?? null,
		reportedCostUsd: null
	};
}

/** Price Codex usage with the shared rate card when the run has no saved cost. */
export function trackerRunCost(
	row: TrackerRunRow,
	usage: TaskUsage = trackerUsage(row)
): TaskApiCost {
	const usd = row.cost_usd ?? null;
	if (usd === null && row.cli === 'codex') return estimateApiCost(row.model, usage);
	return {
		usd,
		minimumUsd: usd,
		maximumUsd: usd,
		basis: usd == null ? 'unavailable' : 'standard-api-estimate',
		rateCard: 'tracker-legacy-flat',
		source: null,
		note: 'Historical estimate recorded using the Tracker rung’s configured flat rates.'
	};
}
