import { expect, test } from 'vitest';
import { measureWorkload } from '../../support/measureWorkload';
import { pickTrackerModel } from '../../../src/utils/agents-providers/pickTrackerModel';
import {
	trackerModelHistory,
	trackerRunReport
} from '../../../src/utils/agents-providers/trackerRunReport';
import type { TrackerRunRow } from '../../../src/utils/agents-providers/trackerRunReport.types';

function run(id: number, fields: Partial<TrackerRunRow> = {}): TrackerRunRow {
	return {
		id,
		node: 'synthetic-local',
		item_id: `item-${id}`,
		state: 'finished',
		outcome: 'done',
		cli: 'claude',
		model: 'claude-haiku-5-5',
		rung: 'haiku',
		kind: 'triage',
		project: 'Harness',
		...fields
	};
}

test('learns to escalate from comparable recorded outcomes and ignores pins and neutral outcomes', () => {
	const rows = [
		run(1, { cost_usd: 0.01 }),
		run(2, { outcome: 'rejected', cost_usd: 0.02 }),
		run(3, { node: 'synthetic-remote', outcome: 'timed_out' }),
		run(4, { outcome: 'blocked' }),
		run(5, { outcome: 'abandoned' }),
		run(6, { pinned: 1 }),
		run(7, { state: 'running', outcome: null }),
		run(8, { kind: 'docs' }),
		run(9, { project: 'Other' })
	];
	const history = trackerModelHistory(rows, { kind: 'triage', project: 'Harness' });
	expect(history).toEqual({ haiku: { ok: 1, fail: 2 } });
	expect(
		pickTrackerModel({ agent: 'Harness', title: 'Review module screenshots' }, { history })
	).toMatchObject({
		rung: { id: 'terra' },
		reason: 'triage/small: terra; haiku succeeded 33% on similar tasks'
	});
});

test('falls back to kind, then project, only after the more specific scope lacks samples', () => {
	const rows = [
		run(1),
		run(2, { project: 'Other' }),
		run(3, { project: 'Other' }),
		run(4, { kind: 'docs', outcome: 'failed' }),
		run(5, { kind: 'bugfix', outcome: 'failed' })
	];
	expect(trackerModelHistory(rows, { kind: 'triage', project: 'Harness' })).toEqual({
		haiku: { ok: 3, fail: 0 }
	});
	expect(trackerModelHistory(rows, { kind: 'test', project: 'Harness' })).toEqual({
		haiku: { ok: 1, fail: 2 }
	});
	expect(trackerModelHistory(rows, { kind: 'test', project: 'None' })).toEqual({});
});

test('preserves outcomes and reports cost coverage and measured durations', () =>
	measureWorkload(
		'function.agents-providers-tracker-run-report',
		'cost-coverage-and-duration',
		() => {
			const rows = [
				run(1, {
					cost_usd: 0.25,
					started_at: 1_000,
					ended_at: 61_000,
					idle_nudges: 2,
					input_tokens: 10,
					cache_read_tokens: 20,
					cache_write_tokens: 30,
					output_tokens: 40
				}),
				run(1, { node: 'synthetic-remote', outcome: 'timed_out', cost_usd: 0, redone_by: 'sol' }),
				run(3, { outcome: 'blocked' }),
				run(4, { outcome: 'abandoned' }),
				run(5, { state: 'verifying', cost_usd: 100 }),
				run(6, { cli: 'codex', model: 'gpt-6.2-sol', rung: 'sol', kind: null }),
				run(7, {
					cli: 'codex',
					model: 'gpt-6.2-sol',
					rung: 'sol',
					kind: null,
					input_tokens: 300_000,
					cache_read_tokens: 100_000,
					cache_write_tokens: 0,
					output_tokens: 10_000,
					started_at: null,
					ended_at: 1_700_000_000_000
				}),
				run(8, {
					cli: 'codex',
					model: 'gpt-6.2-sol',
					rung: 'sol',
					kind: null,
					input_tokens: 1_000,
					cache_read_tokens: 1_000,
					cache_write_tokens: 0,
					output_tokens: 1_000
				})
			];
			const report = trackerRunReport(rows);
			const totals = {
				rung: 'haiku',
				kind: '*',
				runs: 4,
				done: 1,
				failed: 1,
				blocked: 1,
				other: 1,
				redone: 1,
				idle_nudges: 2,
				cost: 0.25,
				priced: 2,
				ranged: 0,
				timed: 1,
				min_cost: 0.25,
				max_cost: 0.25,
				tokens: 100,
				ms: 60_000,
				success_rate: 0.5,
				avg_cost_usd: 0.125,
				cost_per_success_usd: 0.25,
				avg_cost_range_usd: null,
				cost_per_success_range_usd: null,
				avg_minutes: 1
			};
			expect(report.slice(0, 2)).toEqual([totals, { ...totals, kind: 'triage' }]);
			for (const row of report.slice(2)) {
				expect(row).toMatchObject({
					rung: 'sol',
					runs: 3,
					done: 3,
					priced: 1,
					ranged: 1,
					timed: 0,
					avg_minutes: null,
					avg_cost_usd: null
				});
				expect(row.avg_cost_range_usd).toEqual([
					expect.closeTo((0.71 + 0.0121) / 2),
					expect.closeTo((1.37 + 0.0121) / 2)
				]);
				expect(row.cost_per_success_range_usd).toEqual([
					expect.closeTo((0.71 + 0.0121) / 3),
					expect.closeTo((1.37 + 0.0121) / 3)
				]);
			}
		}
	));
