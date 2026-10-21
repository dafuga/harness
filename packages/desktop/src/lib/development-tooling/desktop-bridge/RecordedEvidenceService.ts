import type { CacheIdentity } from '../../../../../collaboration/src/models/Collaboration.types';
import { explorerEvidence } from '../../../../../reports/src/utils/explorerEvidence';
import {
	EvidenceRefsAdapter,
	evidenceRef,
	notesRef,
	type CurrentRefs,
	type PinnedRevisions
} from '../../../adapters/EvidenceRefsAdapter';
import { PinnedHistoryAdapter } from '../../../adapters/PinnedHistoryAdapter';
import type {
	EntityEvidenceQuery,
	EntityEvidenceResult,
	EvidenceArtifactQuery,
	EvidenceArtifactResult
} from '../../../models/verification-evidence/DesktopEvidence.types';
import { artifactAnswer } from '../../../utils/development-tooling/artifact-answer/artifactAnswer';
import { gitRead } from '../../../utils/projects-sessions/gitRead';
import { recordedAnswer } from '../../../utils/development-tooling/recorded-answer/recordedAnswer';
import { recordedCapture } from '../../../utils/reports-media/recordedCapture';
import { recordedScope, recordedTip } from '../../../utils/development-tooling/recordedScope';
import type { ProjectSessionService } from '../../../services/projects-sessions/project-session-service/ProjectSessionService';

type Shown = Pick<EntityEvidenceQuery, 'branch' | 'commit'>;
type ProjectRead = Pick<ReturnType<ProjectSessionService['requireProject']>, 'root' | 'source'> & {
	projectId: string;
};
const unbranched = 'Select a local branch to read recorded evidence on.';

/**
 * Recorded runtime evidence of the project a session has open, read from its own repository:
 * the sealed records attached to a commit and to its first parent, each validated in full, and
 * the bytes of one capture such a read listed. Every read is pinned to one notes commit and one
 * evidence commit; an artifact is read at exactly the revisions its request repeats, so notes
 * that moved since never change or break what was shown. Nothing is written.
 */
export class RecordedEvidenceService {
	private read: { root: string; history: PinnedHistoryAdapter } | null = null;

	constructor(private readonly session: ProjectSessionService) {}

	async evidence(query: EntityEvidenceQuery): Promise<EntityEvidenceResult> {
		const project = this.project(query);
		const { root } = project;
		const refs = await new EvidenceRefsAdapter(root).current();
		const { scope, revisions } = await this.scoped(query, refs, project);
		const identity = await this.identity(
			{ branch: query.branch, commit: scope.commit },
			refs,
			project
		);
		return recordedAnswer({ scope, identity, revisions });
	}

	async artifact(query: EvidenceArtifactQuery): Promise<EvidenceArtifactResult> {
		const project = this.project(query);
		const { root } = project;
		const pins = await new EvidenceRefsAdapter(root).pinned(query);
		const { scope, revisions } = await this.scoped(query, pins, project);
		const evidence = explorerEvidence(scope, revisions, { id: query.entityId });
		const found = recordedCapture(evidence, query);
		const files = await this.history(root).files(pins, found.record);
		return artifactAnswer(found.capture, files?.get(found.capture.path));
	}

	private project(query: EntityEvidenceQuery): ProjectRead {
		this.session.assertProject(query.projectId);
		const { root, source } = this.session.requireProject();
		const projectId = this.session.projectId;
		if (!projectId) throw new Error('Open a registered project first.');
		return { root, source, projectId };
	}

	/** One reader for the repository that is open; another repository starts another. */
	private history(root: string): PinnedHistoryAdapter {
		if (this.read?.root !== root) this.read = { root, history: new PinnedHistoryAdapter(root) };
		return this.read.history;
	}

	/** Where a read is in history, and the stored revisions it shows, at pinned revisions. */
	private async scoped(query: EntityEvidenceQuery, pins: PinnedRevisions, project: ProjectRead) {
		const { root, source } = project;
		if (!query.branch) throw new Error(unbranched);
		const { commit, tip } = await source.revision({ branch: query.branch, commit: query.commit });
		recordedTip({ ...query, commit }, tip);
		const history = this.history(root);
		// A commit is compared with its exact first parent; the tip alone, and a first commit, are not.
		const [first] = query.mode === 'commit' ? (await history.facts(commit)).parents : [];
		const [head, parent] = await Promise.all([
			history.revision(pins, commit),
			// A parent that cannot be read is the gap the evidence then states; nothing replaces it.
			first ? history.revision(pins, first).catch(() => null) : null
		]);
		const kind = head.detail.registry.units.find((unit) => unit.id === query.entityId)?.kind;
		const facts = { tip, kind, revision: head.facts, judged: head.judged, legacy: head.legacy };
		const scope = recordedScope({ ...query, commit }, facts);
		return { scope, revisions: { head: head.detail, parent: parent?.detail ?? null } };
	}

	/** What an answer was read at, as the image cache of a local project states it. */
	private async identity(
		at: Shown,
		refs: CurrentRefs,
		project: ProjectRead
	): Promise<CacheIdentity> {
		const { root, projectId } = project;
		const named = ['rev-parse', '--verify', '--end-of-options', `${at.commit}^{tree}`];
		const tree = await gitRead(root, named);
		return {
			principalId: `local-filesystem:${process.getuid?.() ?? 'current'}`,
			projectId,
			repositoryId: 0,
			requestedRef: at.branch,
			sourceCommit: at.commit,
			sourceTree: tree.trim(),
			notesRef,
			notesRevision: refs.notesRevision,
			evidenceRef,
			evidenceRevision: refs.evidenceRevision,
			historyIndexRevision: refs.digest,
			artifactHash: null,
			profile: null
		};
	}
}
