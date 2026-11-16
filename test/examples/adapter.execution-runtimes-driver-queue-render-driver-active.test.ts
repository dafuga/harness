import { test } from 'vitest';
import type { DriverActive } from '../../src/adapters/execution-runtimes/DriverQueueAdapter.types';
import { renderDriverActive } from '../../src/adapters/execution-runtimes/driver-queue/renderDriverActive';
import { recordExampleCases } from '../support/recordExampleCases';
import { expect } from '../verificationExpect';

const populated: DriverActive = {
	updated: '2026-11-16T08:24:00',
	counts: { luna: 2, haiku: 1, total: 3, reverify: 1 },
	totals: { planned: 6, done: 4, pass: 3, fail: 1, remaining: 2 },
	reverify_totals: { planned: 2, done: 2, pass: 1, fail: 1, remaining: 0 },
	active: [
		{
			model: 'luna',
			unit: 'adapter.execution-runtimes-driver-queue-render-driver-active',
			kind: 'reverify',
			task: 'Review formatter output',
			slot: '2',
			pid: 4202,
			started: '2026-11-16T08:20:00Z'
		},
		{
			model: 'haiku',
			unit: 'adapter.execution-runtimes-driver-queue',
			kind: 'code',
			task: 'Check driver snapshot',
			slot: '1',
			pid: 4201,
			started: '2026-11-16T08:19:00Z'
		},
		{ model: 'luna', task: 'Capture example output', slot: '1' }
	]
};
const empty: DriverActive = {
	updated: '2026-11-16T09:00:00',
	counts: { luna: 0, haiku: 0, total: 0, reverify: 0 },
	totals: { planned: 4, done: 1, pass: 1, fail: 0, remaining: 3 },
	reverify_totals: { planned: 0, done: 0, pass: 0, fail: 0, remaining: 0 },
	active: []
};
const populatedExpected =
	[
		'# Active jobs (2026-11-16T08:24:00 Lisbon)',
		'',
		'**Luna 2 · Haiku 1 · total 3** (+ 1 re-verify gate runs). Done 4 (pass 3, fail 1), remaining 2 of 6 planned.',
		'Re-verify: done 2 (pass 1, fail 1), remaining 0 of 2.',
		'',
		'| Model | Kind | Unit | Task | Slot | PID | Started |',
		'|---|---|---|---|---|---:|---|',
		'| haiku | code | adapter.execution-runtimes-driver-queue | Check driver snapshot | 1 | 4201 | 2026-11-16T08:19:00Z |',
		'| luna | job |  | Capture example output | 1 |  |  |',
		'| luna | reverify | adapter.execution-runtimes-driver-queue-render-driver-active | Review formatter output | 2 | 4202 | 2026-11-16T08:20:00Z |'
	].join('\n') + '\n';
const emptyExpected =
	[
		'# Active jobs (2026-11-16T09:00:00 Lisbon)',
		'',
		'**Luna 0 · Haiku 0 · total 0** (+ 0 re-verify gate runs). Done 1 (pass 1, fail 0), remaining 3 of 4 planned.',
		'Re-verify: done 0 (pass 0, fail 0), remaining 0 of 0.',
		'',
		'| Model | Kind | Unit | Task | Slot | PID | Started |',
		'|---|---|---|---|---|---:|---|'
	].join('\n') + '\n';

test('Renders active counts, totals, and ordered jobs', () => {
	const populatedOutput = renderDriverActive(populated);
	const emptyOutput = renderDriverActive(empty);
	expect(populatedOutput).toBe(populatedExpected);
	expect(emptyOutput).toBe(emptyExpected);
	recordExampleCases(
		{
			unitId: 'adapter.execution-runtimes-driver-queue-render-driver-active',
			symbol: 'renderDriverActive',
			state: 'renders-active-counts-totals-and-ordered-jobs',
			evidence: 'examples-cases',
			file: 'renders-active-counts-totals-and-ordered-jobs.json'
		},
		[
			{
				name: 'sorts jobs by model and slot with optional columns blank',
				input: populated,
				output: populatedOutput
			},
			{
				name: 'keeps counts and table headings when no jobs are active',
				input: empty,
				output: emptyOutput
			}
		]
	);
});
