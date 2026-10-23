import { modelMetadata } from './entityClassFixtures';
import type { RecordScenario } from './explorerFixture.types';
import type {
	HarnessCapture,
	HarnessIndex,
	HarnessRecord,
	HarnessRevision,
	HarnessRevisionSummary,
	HarnessScenario,
	HarnessUnit
} from '../src/models/Harness.types';

export const sha = (letter: string) => letter.repeat(40);

/** A unit of a synthetic registry; every part of it can be replaced. */
export function unit(id: string, kind: string, extra: Partial<HarnessUnit> = {}): HarnessUnit {
	return {
		id,
		kind,
		status: 'active',
		title: id.split('.').pop() ?? id,
		responsibility: `What ${id} is for.`,
		dependencies: [],
		scenarios: [],
		owns: { source: [`src/${id}.ts`], symbols: [] },
		contract: { inputs: [], outputs: [], errors: [] },
		runtime: { kind: 'module', targets: [] },
		budgets: { size: 'frozen', complexity: 'frozen', performance: [] },
		version: 'v1',
		// Function fixtures default to shared proof; private/legacy cases explicitly override it.
		...(kind === 'function'
			? {
					helpers: [
						{
							name: id.split('.').pop() ?? id,
							source: `src/${id}.ts`,
							inputs: [],
							pure: true,
							consumers: [{ unit: 'component.first' }, { unit: 'component.second' }]
						}
					]
				}
			: {}),
		...modelMetadata(id, kind, extra),
		...extra
	};
}

export function capture(extra: Partial<HarnessCapture> = {}): HarnessCapture {
	return {
		evidence: 'screens',
		kind: 'screenshot',
		state: 'empty',
		viewport: 'desktop',
		status: 'passed',
		path: 'evidence/empty-desktop.png',
		sha256: 'c'.repeat(64),
		mediaType: 'image/png',
		capturedAt: '2026-10-10T18:00:00.000Z',
		server: { buildId: 'build-1', revision: sha('a') },
		media: `media/${'c'.repeat(64)}.png`,
		...extra
	};
}

/** The declared scenario of a page with one required state at two viewports. */
export function declared(extra: Partial<HarnessScenario> = {}): HarnessScenario {
	return {
		id: 'titles-page',
		title: 'Titles page',
		kind: 'ui',
		units: ['page.titles'],
		states: [{ id: 'empty', coverage: 'required' }],
		viewports: [
			{ id: 'desktop', width: 1440, height: 900 },
			{ id: 'mobile', width: 390, height: 844 }
		],
		tests: [{ id: 'page', kind: 'e2e', runner: 'playwright' }],
		evidence: [
			{ id: 'screens', kind: 'screenshot', states: ['empty'], viewports: ['desktop', 'mobile'] }
		],
		...extra
	};
}

export function result(captures: HarnessCapture[], extra: Partial<RecordScenario> = {}) {
	const made: RecordScenario = {
		id: 'titles-page',
		status: 'passed',
		testedRevision: sha('a'),
		inherited: false,
		origin: { record: 'r1', commit: sha('a') },
		states: [{ id: 'empty', coverage: 'required', captures }],
		...extra
	};
	return made;
}

export function record(scenarios: RecordScenario[], extra: Partial<HarnessRecord> = {}) {
	const made: HarnessRecord = {
		id: 'r1',
		status: 'passed',
		valid: true,
		problems: [],
		source: { commit: sha('a'), base: sha('b') },
		profile: 'p1',
		startedAt: '2026-10-10T18:00:00.000Z',
		finishedAt: '2026-10-10T18:00:01.000Z',
		gates: { snapshot: 'passed', registry: 'passed', tests: 'passed', scenarios: 'passed' },
		failures: [],
		tests: [
			{ id: 't1', kind: 'unit', target: 't1', status: 'passed', durationMs: 1 },
			{ id: 'titles-page:page', kind: 'e2e', target: 'page', status: 'passed', durationMs: 1 }
		],
		scenarios,
		measurements: [],
		budgets: { findings: [] },
		...extra
	};
	return made;
}

export function revision(
	units: HarnessUnit[],
	scenarios: HarnessScenario[],
	records: HarnessRecord[],
	extra: Partial<HarnessRevision> = {}
): HarnessRevision {
	return {
		commit: sha('a'),
		registry: { available: true, units, scenarios, graph: { edges: [] } },
		comparison: null,
		sourceImpact: null,
		records,
		explanations: [],
		...extra
	};
}

export function summary(commit: string, extra: Partial<HarnessRevisionSummary> = {}) {
	const made: HarnessRevisionSummary = {
		commit,
		parents: [],
		subject: `commit ${commit.slice(0, 1)}`,
		author: 'Synthetic',
		committedAt: '2026-10-10T18:00:00+00:00',
		branches: ['main'],
		retained: false,
		coverage: 'verified',
		gaps: [],
		records: [],
		legacy: [],
		...extra
	};
	return made;
}

export function history(extra: Partial<HarnessIndex> = {}): HarnessIndex {
	return {
		branches: [],
		revisions: [],
		units: [],
		benchmarks: [],
		profiles: [],
		legacy: [],
		truncated: false,
		problems: [],
		...extra
	};
}

/** Both viewports of the declared state, captured from the build of the tested commit. */
export const complete = () => [capture(), capture({ viewport: 'mobile', sha256: 'd'.repeat(64) })];

/** What a commit is recorded to have changed, against a base; nothing unless it is named. */
export function impacted(base: string | null, direct: string[] = []) {
	return {
		base,
		expanded: false,
		units: { direct, indirect: [], added: [], removed: [] },
		scenarios: [],
		uncertain: [],
		changed: []
	};
}
