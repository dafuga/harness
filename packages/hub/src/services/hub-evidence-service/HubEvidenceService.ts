import type { Actor } from 'collaboration';
import type {
	EntityEvidenceQuery,
	EntityEvidenceResult,
	EvidenceArtifactQuery
} from '../../../../desktop/src/models/DesktopEvidence.types.ts';
import { evidencePayload } from '../../../../desktop/src/utils/evidencePayload';
import { artifactAnswer } from '../../../../desktop/src/utils/artifact-answer/artifactAnswer';
import { artifactLimit } from '../../../../desktop/src/utils/artifactMedia';
import { recordedAnswer } from '../../../../desktop/src/utils/recorded-answer/recordedAnswer';
import { recordedCapture } from '../../../../desktop/src/utils/recordedCapture';
import { explorerEvidence } from '../../../../reports/src/utils/explorerEvidence';
import { hubFail } from '../../utils/hubJson';
import { hubEvidenceOrigin } from '../../utils/hubEvidenceViews';
import { hubEvidenceContext, hubEvidencePins, hubEvidenceScope } from './hubEvidenceScope';
import { type HubEvidenceDependencies } from '../../utils/hubEvidenceScope';

/** Authenticated request-scoped GitHub readers. Kept answers are disposable and principal scoped. */
export class HubEvidenceService {
	private readonly answers = new Map<string, EntityEvidenceResult>();
	constructor(private readonly deps: HubEvidenceDependencies) {}
	async evidence(
		actor: Actor,
		projectId: string,
		input: EntityEvidenceQuery
	): Promise<EntityEvidenceResult> {
		const query = {
			...evidencePayload('evidence:read', input as unknown as Record<string, unknown>),
			projectId
		} as EntityEvidenceQuery;
		const context = await hubEvidenceContext(this.deps, actor, query);
		const key = JSON.stringify([context.base.identity, query, context.tip]);
		let answer = this.answers.get(key);
		if (!answer) {
			const built = await hubEvidenceScope(context.base, query, context.tip);
			answer = recordedAnswer({ ...built, identity: context.base.identity });
			this.answers.set(key, answer);
			while (this.answers.size > 8) this.answers.delete(this.answers.keys().next().value!);
		}
		await this.authorize(actor, projectId, context.repository);
		return structuredClone(answer);
	}
	async artifact(actor: Actor, projectId: string, input: EvidenceArtifactQuery) {
		const query = {
			...evidencePayload('evidence:artifact', input as unknown as Record<string, unknown>),
			projectId
		} as EvidenceArtifactQuery;
		const context = await hubEvidenceContext(this.deps, actor, query);
		await hubEvidencePins(context.base, query);
		const built = await hubEvidenceScope(context.base, query, context.tip);
		let found;
		try {
			found = recordedCapture(
				explorerEvidence(built.scope, built.revisions, { id: query.entityId }),
				query
			);
		} catch {
			return hubFail('artifact-refused');
		}
		const original = await hubEvidenceOrigin(built.history, found.record);
		if (!original || original.problems.length) return hubFail('artifact-refused');
		const fact = original.facts.get(found.capture.path);
		if (fact && fact.bytes > artifactLimit) return hubFail('artifact-too-large');
		let answer;
		try {
			const bytes = await built.history.attached.readFile(original.pointer, found.capture.path);
			answer = await artifactAnswer(found.capture, bytes);
		} catch {
			return hubFail('artifact-refused');
		}
		await this.authorize(actor, projectId, context.repository);
		return answer;
	}
	private async authorize(actor: Actor, projectId: string, repository: unknown) {
		const current = await this.deps.api.getProject(actor, projectId);
		if (JSON.stringify(current.sourceRepository) !== JSON.stringify(repository))
			return hubFail('forbidden');
	}
}
