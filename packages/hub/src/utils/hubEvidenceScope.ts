import type {
	Actor,
	CollaborationApi,
	CollaborationCache,
	SourceHistoryAdapter
} from 'collaboration';
import type {
	EntityEvidenceQuery,
	EvidenceArtifactQuery
} from '../../../desktop/src/models/DesktopEvidence.types';
import { recordedScope } from '../../../desktop/src/utils/recordedScope';
import { hubSource, type HubSourceContext } from './hubSource';
import { hubNotes } from './hubNotes';
import { hubEvidenceRevision } from './hubEvidenceRevision';
import { hubFail } from './hubJson';
import { HubAttachedService } from '../services/HubAttachedService';
import { HubRecordStatusService } from '../services/HubRecordStatusService';

export interface HubEvidenceDependencies {
	api: CollaborationApi;
	source: SourceHistoryAdapter;
	cache: CollaborationCache;
}
export async function hubEvidenceContext(
	deps: HubEvidenceDependencies,
	actor: Actor,
	query: EntityEvidenceQuery
) {
	if (!query.projectId) return hubFail('forbidden');
	const project = structuredClone(await deps.api.getProject(actor, query.projectId));
	const base = await hubSource({ ...deps, actor, project, ref: query.commit });
	base.identity = { ...base.identity, requestedRef: query.branch };
	const branches = await deps.source.branches(project.sourceRepository);
	const tip = branches.find((branch) => branch.name === query.branch)?.tip;
	if (!tip) return hubFail('evidence-unreadable');
	if (query.mode === 'current' && tip !== query.commit) return hubFail('evidence-stale');
	return { base, tip, repository: project.sourceRepository };
}
export async function hubEvidencePins(
	base: HubSourceContext,
	query: Pick<EvidenceArtifactQuery, 'notesRevision' | 'evidenceRevision'>
) {
	for (const name of ['notesRevision', 'evidenceRevision'] as const) {
		const now = base.identity[name],
			wanted = query[name];
		if (now === wanted) continue;
		if (
			!now ||
			!wanted ||
			!(await base.source.reaches?.(base.repository, {
				tip: now,
				commit: wanted
			}))
		)
			return hubFail('evidence-stale');
	}
	base.identity = {
		...base.identity,
		notesRevision: query.notesRevision,
		evidenceRevision: query.evidenceRevision
	};
}
type Reaches = (tip: string, commit: string) => Promise<boolean>;

/** Record statuses read from the pinned notes, with records followed inside the pinned evidence. */
function pinnedHistory(base: HubSourceContext, reaches: Reaches): HubRecordStatusService {
	const attached = new HubAttachedService({
		base,
		within: base.identity.evidenceRevision,
		reaches
	});
	return new HubRecordStatusService({
		notes: hubNotes(base, base.identity.notesRevision),
		attached,
		tree: async (commit) => (await base.source.facts?.(base.repository, commit))?.tree
	});
}

/**
 * The compared side: the exact first parent, or null where the commit has none.
 * Only genuine absence is a gap; permission, corruption and network failures stay explicit.
 */
async function comparedParent(
	base: HubSourceContext,
	history: HubRecordStatusService,
	first: string | undefined
) {
	if (!first) return null;
	const facts = await base.source.facts?.(base.repository, first);
	return facts ? hubEvidenceRevision(base, history, first) : null;
}

export async function hubEvidenceScope(
	base: HubSourceContext,
	query: EntityEvidenceQuery,
	tip: string
) {
	const reaches: Reaches = (tip, commit) =>
		base.source.reaches?.(base.repository, { tip, commit }) ?? Promise.resolve(false);
	if (query.commit !== tip && !(await reaches(tip, query.commit)))
		return hubFail('evidence-unreadable');
	const history = pinnedHistory(base, reaches);
	const head = await hubEvidenceRevision(base, history, query.commit);
	const first = query.mode === 'commit' ? head.facts.parents[0] : undefined;
	const parent = await comparedParent(base, history, first);
	const kind = head.detail.registry.units.find((unit) => unit.id === query.entityId)?.kind;
	if (!kind) return hubFail('evidence-unreadable');
	const scope = recordedScope(query, {
		tip,
		kind,
		revision: head.facts,
		judged: head.judged,
		legacy: head.legacy
	});
	return {
		scope,
		revisions: { head: head.detail, parent: parent?.detail ?? null },
		history
	};
}
