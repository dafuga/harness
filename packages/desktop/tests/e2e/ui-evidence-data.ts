import type { Mode } from './ui-evidence-data.types';
import { bound, bindingFields } from './ui-evidence-bindings';
export { bindingFields, bindingKey } from './ui-evidence-bindings';
import type { CacheIdentity } from '../../../collaboration/src/models/Collaboration.types';
import type { HarnessUnit } from '../../../reports/src/models/Harness.types';
import { explorerBehavior } from '../../../reports/src/utils/explorerBehavior';
import { explorerEvidence } from '../../../reports/src/utils/explorerEvidence';
import { explorerScope } from '../../../reports/src/utils/harness-page/explorerScope';
import { index } from '../../../reports/test/entityFixture';
import { commits, ids, units } from '../../../reports/test/entityUnits';
import type { EntityEvidenceResult } from '../../src/models/DesktopEvidence.types';
import type { CatalogEntity } from '../../src/models/Desktop.types';
import { catalogListed } from '../../src/utils/catalogUnit';
import { evidenceEntity } from './ui-evidence-entity';
import { nativeImageFixture } from './native-image-fixture';
import { cardScenario, observedHistory, type Example } from './ui-evidence-history';

export { commits, ids };
export { cardScenario, soundScenario, tones } from './ui-evidence-history';
/** SYNTHETIC identities of one project; no repository, account or server stands behind them. */
export const branch = 'feature/orders';
export const sharedProject = '7a2e3d4c-5b6a-4f79-8a81-9b2c3d4e5f60';
export const pinned = { notes: '1'.repeat(40), evidence: '2'.repeat(40) };
export { designSha, planningCommit } from './ui-evidence-entity';
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

/** One incremental record: only the unchanged card and the checks it actually inherited. */
function onlyInherited(history: ReturnType<typeof observedHistory>): void {
	const tip = history.revisions[commits.tip];
	tip.registry.scenarios = tip.registry.scenarios.filter((item) => item.id === cardScenario);
	tip.records[0].scenarios = tip.records[0].scenarios.filter((item) => item.id === cardScenario);
	tip.records[0].tests = [];
}

export function evidenceData(
	shared = false,
	observedUnits: string[] = [],
	example?: Example,
	options: { browserErrors?: unknown[]; inheritedOnly?: boolean } = {}
) {
	const history = observedHistory(observedUnits, options.browserErrors, example);
	if (options.inheritedOnly) onlyInherited(history);
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
		for (const [key, sha256] of bound(found, mode, unit.id, branch)) bindings[key] = sha256;
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
	const entities = units.map((unit) => evidenceEntity(unit, design.length));
	return {
		shared,
		project: { id: sharedProject, name: 'Orders' },
		branch,
		tip: commits.tip,
		commits: listed,
		entities,
		catalog: catalogListed([], entities as CatalogEntity[]),
		design,
		results,
		bindings,
		bindingFields,
		bytes: history.bytes,
		identity: identity(commits.tip, shared)
	};
}

export type { EvidenceData } from './ui-evidence-data.types';
