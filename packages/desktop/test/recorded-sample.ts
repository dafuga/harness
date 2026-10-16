import type { ExplorerScope, ExplorerSide } from '../../reports/src/models/Explorer.types';
import type {
	HarnessCapture,
	HarnessRecord,
	HarnessRevision,
	HarnessScenario,
	HarnessUnit
} from '../../reports/src/models/Harness.types';

export const head = 'a'.repeat(40);
export const parent = 'b'.repeat(40);
export const screen = 'c'.repeat(64);
export const output = 'd'.repeat(64);
export const home = 'page.home';
export const feed = 'service.feed';
const at = '2026-10-01T00:00:00.000Z';

const unit = (id: string, kind: string, uses: string[]): HarnessUnit => ({
	id,
	kind,
	status: 'active',
	title: id,
	responsibility: `Owns ${id}.`,
	dependencies: uses.map((used) => ({ unit: used, via: 'import' })),
	scenarios: [],
	owns: { source: [`src/${id}.ts`], symbols: [] },
	contract: { inputs: [], outputs: [], errors: [] },
	runtime: { kind: 'module', targets: [] },
	budgets: { size: 'frozen', complexity: 'frozen', performance: [] },
	version: `${id}-1`
});
const declared = (id: string, covers: string, kind: string): HarnessScenario => ({
	id,
	title: `${id} scenario`,
	kind: kind === 'screenshot' ? 'ui' : 'headless',
	units: [covers, 'script.fixture'],
	states: [{ id: 'filled', coverage: 'required' }],
	viewports: kind === 'screenshot' ? [{ id: 'desktop', width: 1440, height: 900 }] : [],
	tests: [{ id: 'run', kind: 'e2e', runner: 'command' }],
	evidence: [
		{
			id: 'kept',
			kind,
			states: ['filled'],
			viewports: kind === 'screenshot' ? ['desktop'] : []
		}
	]
});
const capture = (kind: string, sha256: string, commit: string): HarnessCapture => ({
	evidence: 'kept',
	kind,
	state: 'filled',
	...(kind === 'screenshot' ? { viewport: 'desktop' } : {}),
	status: 'passed',
	path: `evidence/${commit}/${kind}.bin`,
	sha256,
	mediaType: kind === 'screenshot' ? 'image/png' : 'text/plain',
	capturedAt: at,
	server: { buildId: 'build', revision: commit },
	media: `media/${sha256}.bin`
});
const ran = (id: string, kind: string, sha256: string, commit: string) => ({
	id,
	status: 'passed' as const,
	testedRevision: commit,
	inherited: false,
	origin: { record: `record-${commit.slice(0, 4)}`, commit },
	states: [{ id: 'filled', coverage: 'required', captures: [capture(kind, sha256, commit)] }]
});

/** One record of a commit that ran both scenarios and measured both units. */
export function sampleRecord(commit: string): HarnessRecord {
	const measured = (id: string) => ({ unit: id, metric: 'source-bytes', unitOfMeasure: 'bytes' });
	const found = (id: string) => ({ unit: id, metric: 'source-bytes', status: 'passed' });
	return {
		id: `record-${commit.slice(0, 4)}`,
		status: 'passed',
		valid: true,
		problems: [],
		source: { commit, base: null },
		profile: 'profile',
		startedAt: at,
		finishedAt: at,
		gates: { tests: 'passed', scenarios: 'passed' },
		failures: [`${feed}: a note of the feed alone`],
		tests: ['home-page:run', 'feed-run:run', 'test/unit.test.ts'].map((id) => ({
			id,
			kind: id.includes(':') ? 'e2e' : 'unit',
			target: id,
			status: 'passed' as const,
			durationMs: 5
		})),
		scenarios: [
			ran('home-page', 'screenshot', screen, commit),
			ran('feed-run', 'output', output, commit)
		],
		measurements: [home, feed].map((id) => ({
			...measured(id),
			value: 10,
			workload: null,
			profile: null
		})),
		budgets: { findings: [home, feed].map((id) => ({ ...found(id), baseline: 10, measured: 10 })) }
	};
}

/** A stored revision with two units, a scenario of each, and one record that ran both. */
export function sampleDetail(commit: string): HarnessRevision {
	const units = { direct: [home], indirect: [feed], added: [], removed: [] };
	const reason = { attempt: 'none', outcome: 'not-applicable' };
	return {
		commit,
		registry: {
			available: true,
			units: [unit(home, 'page', [feed]), unit(feed, 'service', [])],
			scenarios: [declared('home-page', home, 'screenshot'), declared('feed-run', feed, 'output')],
			graph: { edges: [{ from: `unit:${home}`, to: `unit:${feed}`, via: 'import' }] }
		},
		comparison: {
			base: null,
			record: `record-${commit.slice(0, 4)}`,
			units,
			scenarios: ['home-page', 'feed-run'],
			uncertain: [{ node: 'src/x.ts', reason: 'unresolved', detail: 'x' }]
		},
		sourceImpact: {
			base: null,
			expanded: false,
			units,
			scenarios: ['home-page', 'feed-run'],
			uncertain: [],
			changed: [{ path: 'src/service.feed.ts', status: 'M' }]
		},
		side: 'sides/tree.json',
		records: [sampleRecord(commit)],
		explanations: [home, feed].map((id) => ({
			unit: id,
			symbol: 'default',
			change: 'modified',
			behavior: `Changed ${id}.`,
			simplification: reason,
			performance: reason
		})),
		rangeReasons: 3
	};
}

/** The scope of the sample: the head commit of main, compared with its parent. */
export function sampleScope(entity: string, mode: 'current' | 'commit' = 'commit'): ExplorerScope {
	const summary = {
		commit: head,
		parents: [parent],
		subject: 'feat: sample',
		author: 'Sample',
		committedAt: at,
		branches: ['main'],
		retained: false,
		coverage: 'verified' as const,
		gaps: [],
		records: [],
		legacy: []
	};
	return {
		location: {
			branch: 'main',
			commit: mode === 'commit' ? head : null,
			category: 'pages',
			entity
		},
		mode,
		branch: 'main',
		tip: head,
		commit: head,
		atTip: true,
		parent,
		summary
	};
}

/** What a side holds of its revision, by id: the units, the scenarios and what its records ran. */
export function held(side: ExplorerSide | null) {
	if (!side?.detail) throw new Error('This side holds no revision.');
	const { detail } = side;
	const { registry, records } = detail;
	return {
		detail,
		available: registry.available,
		edges: registry.graph.edges,
		units: registry.units.map((unit) => unit.id),
		scenarios: registry.scenarios.map((item) => item.id),
		ran: records.flatMap((item) => item.scenarios.map((run) => run.id)),
		measured: records.flatMap((item) => item.measurements.map((made) => made.unit)),
		explained: detail.explanations.map((reason) => reason.unit)
	};
}
