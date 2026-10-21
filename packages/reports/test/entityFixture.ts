import type { HarnessIndex, HarnessRecord, HarnessRevision } from '../src/models/Harness.types';
import { capture, commits, ids, scenarios, units, type CaptureSeed } from './entityUnits';

type RecordScenario = HarnessRecord['scenarios'][number];

export function tested(
	commit: string,
	id: string,
	states: Array<{ id: string; captures: CaptureSeed[] }>
): RecordScenario {
	return {
		id,
		status: 'passed',
		testedRevision: commit,
		inherited: false,
		origin: { record: `rec-${commit.slice(0, 6)}`, commit },
		states: states.map((state) => ({
			id: state.id,
			coverage: 'required',
			captures: state.captures.map((seed) => capture(commit, { ...seed, state: state.id }))
		}))
	};
}

const shot = (viewport: string): CaptureSeed => ({ kind: 'screenshot', state: '', viewport });
const proof = (kind: string): CaptureSeed => ({ kind, state: '' });

const measure = (target: string, metric: string, value: number | null) => ({
	unit: target,
	metric,
	unitOfMeasure: metric === 'p95-ms' ? 'ms' : 'bytes',
	value,
	workload: metric === 'p95-ms' ? 'thousand-orders' : null,
	profile: metric === 'p95-ms' ? 'bun-reference' : null
});
const job = (scenario: string, test: string, durationMs: number) => ({
	// A record names the job of a scenario test by both, as the host requires of it.
	id: `${scenario}:${test}`,
	kind: 'e2e',
	target: scenario,
	status: 'passed' as const,
	durationMs
});

/** What a record measured: sizes of units, one timing, and the emitted size of each target. */
const measured = (p95: number): HarnessRecord['measurements'] => [
	measure(ids.list, 'source-bytes', 2400),
	measure(ids.list, 'complexity', 3),
	measure(ids.filter, 'source-bytes', 800),
	measure(ids.filter, 'p95-ms', p95),
	{ ...measure(ids.store, 'artifact-bytes', 18000), target: 'wasm' },
	{ ...measure(ids.store, 'artifact-bytes', null), target: 'process', unavailable: 'no toolchain' }
];

/** A passing record of one commit; `empty` is whether the empty state was captured there. */
export function record(commit: string, empty = true, p95 = 0.12): HarnessRecord {
	return {
		id: `rec-${commit.slice(0, 6)}-0000`,
		status: 'passed',
		valid: true,
		problems: [],
		source: { commit, base: null },
		profile: 'bun-reference',
		startedAt: '2026-10-09T09:59:00.000Z',
		finishedAt: '2026-10-09T10:00:00.000Z',
		gates: { tests: 'passed', scenarios: 'passed' },
		failures: [],
		tests: [job('orders-page', 'orders-browser', 900), job('order-filter', 'filter-flow', 40)],
		scenarios: [
			tested(commit, 'orders-page', [
				{ id: 'default', captures: [shot('desktop'), shot('mobile')] },
				...(empty ? [{ id: 'empty', captures: [shot('desktop'), shot('mobile')] }] : [])
			]),
			tested(commit, 'order-filter', [
				{ id: 'match', captures: [proof('assertions'), proof('output')] },
				{ id: 'no-match', captures: [proof('assertions')] }
			])
		],
		measurements: measured(p95),
		budgets: { findings: [] }
	};
}

const changedBy = (commit: string) => (commit === commits.tip ? [] : [ids.list, ids.filter]);

export function revision(commit: string, records: HarnessRecord[]): HarnessRevision {
	return {
		commit,
		registry: { available: true, units, scenarios, graph: { edges: [] } },
		comparison: null,
		sourceImpact: {
			base: null,
			expanded: false,
			// The tip left these units as they were; each commit before it changed two of them.
			units: { direct: changedBy(commit), indirect: [ids.page], added: [], removed: [] },
			scenarios: ['orders-page'],
			uncertain: [],
			changed: []
		},
		records,
		explanations: [
			{
				unit: ids.filter,
				symbol: 'filterOrders',
				change: 'modified',
				behavior: 'Matches orders regardless of case.',
				simplification: { attempt: 'Removed the second normalization.', outcome: 'improved' },
				performance: { attempt: 'Normalizes once per request.', outcome: 'improved' }
			}
		]
	};
}

const summary = (commit: string, parents: string[], subject: string, day: string) => ({
	commit,
	parents,
	subject,
	author: 'Fixture',
	committedAt: `2026-10-${day}T09:00:00.000Z`,
	branches: commit === commits.first ? ['feature/orders', 'release/orders'] : ['feature/orders'],
	retained: false,
	coverage: 'verified' as const,
	gaps: [],
	records: [],
	legacy: []
});

const told = (direct: string[], base: string = commits.middle) => ({
	base,
	direct,
	added: [],
	removed: []
});

export const index: HarnessIndex = {
	sourceRepository: 'https://github.com/example/orders',
	branches: [
		{ name: 'feature/orders', head: commits.tip },
		{ name: 'release/orders', head: commits.first }
	],
	// What each commit changed itself against its first parent, as a built history records it.
	revisions: [
		{ ...summary(commits.tip, [commits.middle], 'feat: sort orders', '10'), changes: told([]) },
		{
			...summary(commits.middle, [commits.first], 'feat: case-insensitive search', '09'),
			changes: told([ids.list, ids.filter], commits.first)
		},
		{
			...summary(commits.first, [], 'feat: orders page', '08'),
			changes: { base: null, direct: [], added: Object.values(ids), removed: [] }
		}
	],
	units: [
		{
			id: ids.filter,
			growth: [
				{ commit: commits.first, record: 'r1', 'source-bytes': 1000, complexity: 3 },
				{ commit: commits.middle, record: 'r2', 'source-bytes': 1200, complexity: 2 },
				{ commit: commits.tip, record: 'r3', 'source-bytes': 1200, complexity: 2 }
			],
			reviews: [
				{
					type: 'approval',
					commit: commits.middle,
					record: 'r2',
					reviewer: 'Fixture reviewer',
					reason: 'Case folding needs the extra table.',
					at: '2026-10-09T11:00:00.000Z',
					before: { 'source-bytes': 1000 },
					after: { 'source-bytes': 1200 }
				}
			]
		}
	],
	benchmarks: [
		{
			unit: ids.filter,
			workload: 'thousand-orders',
			metric: 'p95-ms',
			target: null,
			incompatible: true,
			series: [
				{
					profile: 'bun-reference',
					unitOfMeasure: 'ms',
					method: 'p95',
					points: [
						{ commit: commits.first, record: 'r1', value: 0.15 },
						{ commit: commits.middle, record: 'r2', value: 0.12 }
					]
				},
				{
					profile: 'ci-linux',
					unitOfMeasure: 'ms',
					method: 'p95',
					points: [{ commit: commits.middle, record: 'r2b', value: 0.31 }]
				}
			]
		}
	],
	profiles: [],
	legacy: [],
	truncated: false,
	problems: []
};
