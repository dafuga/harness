import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import {
	indexedRecordSchema,
	indexedRevisionSchema,
	benchmarkSeriesSchema,
	legacyMediaSchema,
	legacyEntrySchema,
	historyIndexSchema,
	indexedExplanationSchema
} from '../../src/core/git-source-history/historyIndexTypes';

const commit = 'a'.repeat(40);
const record = {
	id: 'verify-42',
	status: 'passed',
	profile: 'linux-node',
	finishedAt: '2026-11-16T10:00:00Z',
	base: null,
	valid: true,
	problems: []
};
const revision = {
	commit,
	tree: commit,
	parents: [],
	subject: 'Add history index',
	author: 'Example Author',
	authoredAt: '2026-11-16T09:00:00Z',
	committedAt: '2026-11-16T09:30:00Z',
	branches: ['main'],
	retained: false,
	coverage: 'verified',
	gaps: [],
	records: [record],
	reasons: 0,
	legacy: [],
	changes: { base: null, direct: ['function.history-index-types'], added: [], removed: [] },
	detail: 'revisions/a.json'
};
const explanation = {
	unit: 'function.history-index-types',
	symbol: 'historyIndexSchema',
	change: 'added',
	from: null,
	to: null,
	behavior: 'Defines stored history index shapes.',
	simplification: { attempt: 'Keep the schema declarations focused.', outcome: 'improved' },
	performance: { attempt: 'No performance change was needed.', outcome: 'not-applicable' },
	recordedAt: '2026-11-16T10:00:00Z'
};

test('History index schemas validate revisions, measurements and legacy evidence', () => {
	const inputs = {
		record,
		revision,
		benchmark: {
			unit: 'function.history-index-types',
			workload: 'parse-index',
			metric: 'latency-warm-ms',
			target: 'module',
			incompatible: false,
			series: [
				{
					profile: 'linux-node',
					unitOfMeasure: 'ms',
					method: 'timer',
					comparison: {
						request: 'b'.repeat(64),
						boundary: 'public-invocation',
						protocol: 'harness-rounds/1',
						sampling: { warmup: 3, rounds: 2, iterations: 1 }
					},
					points: [{ commit, record: 'verify-42', value: 1.25 }]
				}
			]
		},
		media: {
			id: 'shot-1',
			title: 'Desktop',
			file: 'desktop.png',
			status: 'passed',
			provenance: 'legacy-report',
			sha256: null,
			bytes: null,
			media: null,
			gap: 'Original bytes were unavailable.'
		},
		legacy: {
			id: 'run-1',
			title: 'Old run',
			mode: 'browser',
			environment: 'desktop',
			status: 'running',
			state: 'started',
			startedAt: '2026-11-15T10:00:00Z',
			updatedAt: '2026-11-15T10:01:00Z',
			revision: 'old-revision-label',
			linked: null,
			summary: 'Run was still in progress.',
			checks: [],
			media: []
		},
		index: {
			schemaVersion: 1,
			refs: { evidence: commit, notes: null },
			branches: [{ name: 'main', head: commit }],
			revisions: [revision],
			units: [],
			benchmarks: [],
			profiles: [
				{
					id: 'linux-node',
					platform: 'linux',
					arch: 'x64',
					cpu: 'example-cpu',
					cores: 4,
					memoryBytes: 8_000_000_000,
					runtime: 'node 22'
				}
			],
			legacy: [],
			truncated: false,
			problems: []
		},
		explanation
	};
	const parsed = [
		indexedRecordSchema.safeParse(inputs.record),
		indexedRevisionSchema.safeParse(inputs.revision),
		benchmarkSeriesSchema.safeParse(inputs.benchmark),
		legacyMediaSchema.safeParse(inputs.media),
		legacyEntrySchema.safeParse(inputs.legacy),
		historyIndexSchema.safeParse(inputs.index),
		indexedExplanationSchema.safeParse(inputs.explanation)
	];
	expect(parsed.every((result) => result.success)).toBe(true);
	recordExampleCases(
		{
			unitId: 'function.history-index-types',
			symbol: 'historyIndexSchema',
			state: 'history-index-schemas-validate-revisions-measurements-and-le',
			evidence: 'examples-cases',
			file: 'history-index-schemas-validate-revisions-measurements-and-legacy-evidence.json'
		},
		[
			{
				name: 'valid attached record',
				input: inputs.record,
				output: { accepted: parsed[0].success }
			},
			{
				name: 'revision carries coverage and direct changes',
				input: inputs.revision,
				output: { accepted: parsed[1].success }
			},
			{
				name: 'benchmark separates its profile and comparison context',
				input: inputs.benchmark,
				output: { accepted: parsed[2].success }
			},
			{
				name: 'legacy media records unavailable bytes as a gap',
				input: inputs.media,
				output: { accepted: parsed[3].success }
			},
			{
				name: 'legacy entry preserves a running status and unresolved revision',
				input: inputs.legacy,
				output: { accepted: parsed[4].success }
			},
			{
				name: 'version one index includes a profile and revision',
				input: inputs.index,
				output: { accepted: parsed[5].success }
			},
			{
				name: 'indexed explanation retains its stored fields',
				input: inputs.explanation,
				output: { accepted: parsed[6].success }
			}
		]
	);
});
