import { describe, expect, test } from 'vitest';
import { WatchdogIdleService } from '../../../src/services/projects-sessions/WatchdogIdleService';
import type { IdleScan } from '../../../src/services/projects-sessions/WatchdogIdleService.types';
import { claude, host, item, minute, now, pane, run } from './watchdog-fixtures';

const service = new WatchdogIdleService();
const input = { host, now, items: [item()], runs: [run()], panes: [pane()] } satisfies IdleScan;

describe('WatchdogIdleService.plan', () => {
	test('nudges once, then alerts, with a quota hold taking precedence', () => {
		expect(service.plan(input)).toEqual({
			actions: [
				{
					id: item().id,
					pane: pane().name,
					paneKey: pane().key,
					runId: 4,
					cli: 'codex',
					action: 'nudge',
					idleMinutes: 11
				}
			],
			abandonRunIds: []
		});
		expect(service.plan({ ...input, runs: [run({ idleNudges: 1 })] }).actions[0]?.action).toBe(
			'alert'
		);
		expect(service.plan({ ...input, quotaHolds: ['codex'] }).actions[0]).toMatchObject({
			action: 'alert',
			reason: `codex quota exhausted on ${host}`
		});
	});

	test('protects active, recent, blocked, closed, mismatched or already escalated sessions', () => {
		const states: Partial<IdleScan>[] = [
			{ itemId: 'absent' },
			{ panes: [pane({ activity: now - 10 * minute })] },
			{ panes: [pane({ screen: claude })] },
			{ panes: [pane({ runnerSocket: false })] },
			{ panes: [pane({ live: false })] },
			{ items: [item({ needsDaniel: true })] },
			{ items: [item({ status: 'done' })] },
			{ runs: [run({ state: 'finished' })] },
			{ runs: [run({ idleEscalatedAt: now - minute })] },
			{ runs: [run({ resumedAt: now - minute })] },
			{ runs: [run({ idleNudgedAt: now - minute })] }
		];
		for (const state of states) expect(service.plan({ ...input, ...state }).actions).toEqual([]);
	});

	test('prioritizes orchestrators and hand launches, taking one eligible pane per item', () => {
		const manual = pane({ name: 'auto-abc123', runnerSocket: false });
		const orchestrator = item({ id: 'def123fghj', title: 'Orchestrate fixture work' });
		const orchestratorPane = pane({ name: 'auto-def123-r1' });
		const normal = item({ id: 'ghi123fghj' });
		const normalPane = pane({ name: 'auto-ghi123-r2' });
		const scan: IdleScan = {
			...input,
			items: [item(), orchestrator, normal],
			panes: [normalPane, pane(), manual, orchestratorPane],
			runs: [
				run(),
				run({ id: 10, itemId: orchestrator.id, tmux: orchestratorPane.name }),
				run({ id: 11, itemId: normal.id, tmux: normalPane.name })
			]
		};
		expect(service.plan(scan).actions.map(({ pane: name, runId }) => [name, runId])).toEqual([
			[orchestratorPane.name, 10],
			[manual.name, null],
			[normalPane.name, 11]
		]);
	});

	test('abandons observed sessions whose item closes or pane ends, while retaining missing items', () => {
		const manual = pane({ name: 'auto-abc123' });
		const watched = run({ state: 'observed', watchPane: manual.key });
		expect(service.plan({ ...input, panes: [manual], runs: [watched] }).actions[0]?.runId).toBe(
			watched.id
		);
		expect(
			service.plan({
				...input,
				panes: [manual],
				runs: [watched],
				items: [item({ status: 'ignored' })]
			}).abandonRunIds
		).toEqual([watched.id]);
		expect(service.plan({ ...input, panes: [], runs: [watched] }).abandonRunIds).toEqual([
			watched.id
		]);
		expect(service.plan({ ...input, items: [], panes: [], runs: [watched] }).abandonRunIds).toEqual(
			[]
		);
	});
});
