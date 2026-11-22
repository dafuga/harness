import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { harnessEmittedGrowth } from '../../src/components/explorer-ui/harness-growth/harnessEmittedGrowth';
import type { HarnessIndex } from '../../src/models/explorer-ui/Harness.types';

const index = {
	branches: [{ name: 'main', head: 'new' }],
	revisions: [
		{ commit: 'new', parents: ['old'], subject: 'Bundle font', author: 'Sam', committedAt: '2026-11-12T09:41:17+00:00', branches: ['main'], retained: true, coverage: 'verified', gaps: [], records: [], legacy: [] },
		{ commit: 'old', parents: [], subject: 'Set baseline', author: 'Priya', committedAt: '2026-11-09T14:31:08+00:00', branches: ['main'], retained: true, coverage: 'verified', gaps: [], records: [], legacy: [] }
	],
	units: [{
		id: 'reports.function.harness-emitted-growth',
		growth: [
			{ commit: 'old', record: 'baseline-record', emitted: { process: 1843200 }, notes: { 'artifact-bytes:wasm': 'target unavailable' } },
			{ commit: 'new', record: 'new-record', emitted: { process: 1858000 }, notes: { 'artifact-bytes:wasm': 'target unavailable' } }
		],
		reviews: [
			{ type: 'baseline', commit: 'old', record: 'baseline-record', reviewer: 'Ada', reason: 'First limits.', at: '2026-11-09T15:04:31.207Z', after: { 'artifact-bytes:process': 1843200 }, unmeasured: { 'artifact-bytes:wasm': 'target unavailable' } },
			{ type: 'approval', commit: 'new', record: 'new-record', reviewer: 'Ada', reason: 'Font growth.', at: '2026-11-12T11:20:06.552Z', before: { 'artifact-bytes:process': 1843200 }, after: { 'artifact-bytes:process': 1858000 }, unmeasured: { 'artifact-bytes:wasm': 'target unavailable' } }
		]
	}],
	benchmarks: [], profiles: [], legacy: [], truncated: false, problems: []
} satisfies HarnessIndex;

test('Builds emitted growth history with prior limits and reviews', () => {
	const result = harnessEmittedGrowth(index, 'reports.function.harness-emitted-growth');
	expect(result.targets.map(({ id, label }) => [id, label])).toEqual([
		['process', 'process (native)'], ['wasm', 'Wasm']
	]);
	expect(result.rows.map(({ commit, cells, changed }) => ({ commit, process: cells.process, wasm: cells.wasm, changed }))).toEqual([
		{ commit: 'old', process: { value: 1843200 }, wasm: { note: 'target unavailable' }, changed: false },
		{ commit: 'new', process: { value: 1858000, delta: 14800, limit: 1843200 }, wasm: { note: 'target unavailable', unlimited: 'target unavailable' }, changed: true }
	]);
	recordExampleCases(
		{ unitId: 'reports.function.harness-emitted-growth', symbol: 'harnessEmittedGrowth', state: 'builds-emitted-growth-history-with-prior-limits-and-reviews', evidence: 'examples-cases', file: 'builds-emitted-growth-history-with-prior-limits-and-reviews.json' },
		[{ name: 'Two commits with a measured process target and unbuildable wasm target', input: index, output: result }]
	);
});
