import type { CacheIdentity } from '../../../collaboration/src/models/Collaboration.types';
import type { ExplorerSide } from '../../../reports/src/models/Explorer.types';
import type { HarnessUnit } from '../../../reports/src/models/Harness.types';
import { explorerBehavior } from '../../../reports/src/utils/explorerBehavior';
import { explorerEvidence } from '../../../reports/src/utils/explorerEvidence';
import { explorerScope } from '../../../reports/src/utils/explorerScope';
import { index } from '../../../reports/test/entityFixture';
import { commits, ids, units } from '../../../reports/test/entityUnits';
import type { EntityEvidenceResult } from '../../src/models/DesktopEvidence.types';
import { nativeImageFixture } from './native-image-fixture';
import { sealedHistory } from './ui-evidence-history';

export { commits, ids };
export { cardScenario, soundScenario, tones } from './ui-evidence-history';
/** SYNTHETIC identities of one project; no repository, account or server stands behind them. */
export const branch = 'feature/orders';
export const sharedProject = '7a2e3d4c-5b6a-4f79-8a81-9b2c3d4e5f60';
export const pinned = { notes: '1'.repeat(40), evidence: '2'.repeat(40) };
export const designSha = 'b'.repeat(64);
/** A commit of a planning branch: the shown branch does not list it, so nothing proves it. */
export const planningCommit = '9'.repeat(40);
type Mode = 'current' | 'commit';
const categories: Record<string, string> = {
	page: 'pages',
	component: 'components',
	function: 'functions',
	config: 'configs',
	service: 'services'
};
const short = (commit: string) => commit.slice(0, 7);

function identity(commit: string, shared: boolean): CacheIdentity {
	return {
		principalId: shared ? 'google:ada' : 'local',
		projectId: sharedProject,
		repositoryId: 4242,
		requestedRef: `refs/heads/${branch}`,
		sourceCommit: commit,
		sourceTree: 'e'.repeat(40),
		notesRef: 'refs/notes/harness',
		notesRevision: pinned.notes,
		evidenceRef: 'refs/harness/evidence',
		evidenceRevision: pinned.evidence,
		historyIndexRevision: null,
		artifactHash: null,
		profile: 'bun-reference'
	};
}

const happened = (id: string, kind: string, title: string, commit: string) => ({
	id,
	at: '2026-10-09T09:00:00.000Z',
	kind,
	title,
	detail: `Detail of ${title}`,
	commit,
	version: null
});
/** What happened to the filter: one change in the shown branch, one plan committed elsewhere. */
const filterHistory = [
	happened('changed', 'commit', 'feat: case-insensitive search', commits.middle),
	happened('planned', 'design', 'Plan of the filter committed', planningCommit)
];

/** What the viewer lists and opens for one unit; the page has one committed design as well. */
function entity(unit: HarnessUnit, image: number) {
	const designed = unit.id === ids.page;
	const design = {
		version: 'v001',
		createdAt: '2026-10-08',
		commit: commits.first,
		generator: 'GPT Image',
		prompt: 'Orders page',
		baseRevision: commits.first,
		images: [{ state: 'default', viewport: 'desktop', sha256: designSha, bytes: image }],
		approval: null
	};
	const thumbnail = { version: 'v001', sha256: designSha, state: 'default', viewport: 'desktop' };
	return {
		id: unit.id,
		category: categories[unit.kind],
		kind: unit.kind,
		title: unit.title,
		summary: unit.responsibility,
		changed: false,
		planned: false,
		hasPlan: false,
		lifecycle: null,
		verification: 'unverified',
		verificationNote: 'No verification recorded for this revision.',
		latestVersion: designed ? 'v001' : null,
		approvedVersion: null,
		threadCount: 0,
		thumbnail: designed ? thumbnail : null,
		contract: { ...unit.contract, hash: null },
		relationships: [],
		versions: designed ? [design] : [],
		threads: [],
		history: unit.id === ids.filter ? filterHistory : [],
		sources: unit.owns.source,
		size: { available: false, text: 'Not measured' },
		performance: { available: false, text: 'Not measured' }
	};
}

/** What binds one request for bytes: every field the bridge is given, in one fixed order. */
export const bindingFields = [
	'entityId',
	'mode',
	'commit',
	'branch',
	'side',
	'recordId',
	'scenarioId',
	'state',
	'evidenceId',
	'viewport',
	'sha256',
	'notesRevision',
	'evidenceRevision'
] as const;
export const bindingKey = (query: Record<string, unknown>) =>
	bindingFields.map((name) => query[name] ?? '').join('|');

/** Every capture an answer lists, by the binding a request for its bytes has to state. */
function bound(result: EntityEvidenceResult, mode: Mode, unit: string) {
	const { scope, identity: pin, evidence } = result;
	const sides: Array<['before' | 'after', ExplorerSide | null]> = [
		['before', evidence.before],
		['after', evidence.after]
	];
	return sides.flatMap(([side, held]) =>
		(held?.captures ?? []).map((found) => {
			const { capture } = found;
			const key = bindingKey({
				entityId: unit,
				mode,
				commit: scope.commit,
				branch,
				side,
				recordId: held?.record?.id,
				scenarioId: found.scenario,
				state: found.state,
				evidenceId: capture.evidence,
				viewport: capture.viewport,
				sha256: capture.sha256,
				notesRevision: pin.notesRevision,
				evidenceRevision: pin.evidenceRevision
			});
			return [key, capture.sha256] as const;
		})
	);
}

/** Only the test fixture assigns extra entities to these recorded observations. */
function observe(history: ReturnType<typeof sealedHistory>, observedUnits: string[]) {
	// Only this synthetic fixture opts extra entities into the recorded search observations.
	for (const revision of Object.values(history.revisions)) {
		revision.registry = {
			...revision.registry,
			scenarios: revision.registry.scenarios.map((scenario) =>
				scenario.id === 'order-filter'
					? { ...scenario, units: [...new Set([...scenario.units, ...observedUnits])] }
					: scenario
			)
		};
	}
}

export function evidenceData(shared = false, observedUnits: string[] = []) {
	const history = sealedHistory();
	observe(history, observedUnits);
	const design = Array.from(nativeImageFixture());
	const results: Record<string, EntityEvidenceResult> = {};
	const bindings: Record<string, string> = {};
	const read = (unit: HarnessUnit, mode: Mode, commit: string) => {
		const named = mode === 'commit' ? commit : null;
		const location = { branch, commit: named, category: 'pages' as const, entity: unit.id };
		const resolved = explorerScope(index, location);
		if (resolved.kind !== 'scope') throw new Error(resolved.message);
		const { scope } = resolved;
		const head = history.revisions[scope.commit];
		const parent = scope.parent ? (history.revisions[scope.parent] ?? null) : null;
		const evidence = explorerEvidence(scope, { head, parent }, unit);
		const found = {
			scope,
			identity: identity(scope.commit, shared),
			evidence,
			behavior: explorerBehavior(evidence)
		};
		results[`${unit.id}|${mode}|${scope.commit}`] = found;
		for (const [key, sha256] of bound(found, mode, unit.id)) bindings[key] = sha256;
	};
	for (const unit of units) {
		read(unit, 'current', commits.tip);
		for (const commit of Object.values(commits)) read(unit, 'commit', commit);
	}
	const listed = [commits.tip, commits.middle, commits.first].map((hash) => ({
		hash,
		subject: `Commit ${short(hash)}`,
		authoredAt: '2026-10-10'
	}));
	return {
		shared,
		project: { id: sharedProject, name: 'Orders' },
		branch,
		tip: commits.tip,
		commits: listed,
		entities: units.map((unit) => entity(unit, design.length)),
		design,
		results,
		bindings,
		bindingFields,
		bytes: history.bytes,
		identity: identity(commits.tip, shared)
	};
}
export type EvidenceData = ReturnType<typeof evidenceData>;
