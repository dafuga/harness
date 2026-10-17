import type { EntityEvidenceResult } from '../../../desktop/src/models/DesktopEvidence.types';
import { explorerBehavior } from '../../../reports/src/utils/explorerBehavior';
import type { HostedCall } from './hosted-fixture';
import { ada, tip, type HostedProject } from './hosted-data';

const gap = 'No verification recorded for this revision.';

/** A successful evidence read of an unverified fixture project, as the real API returns it. */
export function hostedEvidence(project: HostedProject, call: HostedCall): EntityEvidenceResult {
	const scope = evidenceScope(project, call);
	const evidence: EntityEvidenceResult['evidence'] = {
		mode: scope.mode,
		scenarios: [],
		after: { commit: scope.commit, detail: null, record: null, captures: [], coverage: [], gap },
		before: null,
		initial: gap,
		incomparable: []
	};
	return {
		scope,
		identity: evidenceIdentity(project, scope),
		evidence,
		behavior: explorerBehavior(evidence)
	};
}

function evidenceScope(project: HostedProject, call: HostedCall): EntityEvidenceResult['scope'] {
	const commit = call.query.commit || tip;
	const branch = call.query.branch || project.branch;
	const mode = call.query.mode === 'commit' ? 'commit' : 'current';
	return {
		location: {
			branch,
			commit: mode === 'commit' ? commit : null,
			category: 'pages',
			entity: project.entity.id
		},
		mode,
		branch,
		commit,
		tip,
		atTip: commit === tip,
		parent: null,
		summary: {
			commit,
			parents: [],
			subject: 'Synthetic project',
			author: 'Fixture',
			committedAt: '2026-10-12',
			branches: [branch],
			retained: true,
			coverage: 'unverified',
			gaps: [gap],
			records: [],
			legacy: []
		}
	};
}

function evidenceIdentity(
	project: HostedProject,
	scope: EntityEvidenceResult['scope']
): EntityEvidenceResult['identity'] {
	return {
		principalId: ada.id,
		projectId: project.id,
		repositoryId: project.sourceRepository.id,
		requestedRef: scope.branch!,
		sourceCommit: scope.commit,
		sourceTree: 'e'.repeat(40),
		notesRef: null,
		notesRevision: null,
		evidenceRef: null,
		evidenceRevision: null,
		historyIndexRevision: null,
		artifactHash: null,
		profile: null
	};
}
