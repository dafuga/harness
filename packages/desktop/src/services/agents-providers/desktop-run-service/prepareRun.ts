import { prepareChangeEnvironment } from '../../../utils/promoteChange';
import type { Preparation } from '../../../utils/agents-providers/prepareRun';
import { imageModel, messageFor } from '../../../utils/agents-providers/prepareRun';
import { createHash, randomUUID } from 'node:crypto';
import { RecordedEvidenceService } from '../../RecordedEvidenceService';
import type {
	EntityEvidenceQuery,
	EntityEvidenceResult
} from '../../../models/verification-evidence/DesktopEvidence.types';
import type { RunRequest } from '../../../models/development-tooling/DesktopBridge.types';
import type { RunContext } from '../../../models/development-tooling/RunContext.types';
import { RunCancelled } from '../../../models/agents-providers/AgentRunner.types';
import { approvalMatch } from './approvalMatch';

export async function prepareRun(
	preparation: Preparation,
	request: RunRequest,
	controller: AbortController
): Promise<RunContext> {
	await prepareChangeEnvironment(preparation.session, request);
	const project = await preparation.session.mutable(),
		entity = await project.catalog.entity(request.entityId, project.revision.commit);
	const runner = await preparation.providers.select(
		request.provider,
		request.model,
		request.effort
	);
	if (!entity.threads.some((t) => t.id === request.threadId))
		throw new Error('Thread does not belong to this entity.');
	approvalMatch(entity, request);
	const context: RunContext = {
		...project,
		...preparation,
		id: randomUUID(),
		request,
		entity,
		runner,
		imageModel: await imageModel(preparation, request, entity.category),
		signal: controller.signal
	};
	if (request.mode === 'plan' && ['pages', 'layouts', 'components'].includes(entity.category))
		context.currentImage = currentImage(preparation, context);
	/* Cancelled or revoked while it was prepared: nothing is written and no CLI starts. */
	if (controller.signal.aborted) throw new RunCancelled();
	await project.planning.appendMessage(messageFor(context, 'user', request.text));
	return context;
}

function currentImage(preparation: Preparation, context: RunContext) {
	const projectId = preparation.session.projectId;
	const plannedOnly = context.entity.planned === true;
	const query = {
		projectId: projectId ?? undefined,
		entityId: context.entity.id,
		branch: context.revision.branch,
		commit: context.revision.commit,
		mode: 'commit' as const
	};
	const { state, viewport } = threadView(context);
	return async (): Promise<Uint8Array | null> => {
		if (!projectId)
			throw new Error('A selected project is required for current screenshot evidence.');
		preparation.session.assertProject(projectId);
		if (context.signal.aborted) throw new RunCancelled();
		if (plannedOnly) return null;
		const evidence = preparation.evidence ?? new RecordedEvidenceService(preparation.session);
		const result = await evidence.evidence(query);
		validateEvidenceIdentity(result, query);
		const selected = selectCapture(result, state, viewport);
		if (!selected) return null;
		const capture = selected.capture;
		const binding = {
			...query,
			side: 'after' as const,
			recordId: result.evidence.after.record!.id,
			scenarioId: selected.scenario,
			state: selected.state,
			evidenceId: capture.evidence,
			viewport: capture.viewport ?? null,
			sha256: capture.sha256,
			notesRevision: result.identity.notesRevision,
			evidenceRevision: result.identity.evidenceRevision
		};
		preparation.session.assertProject(projectId);
		const artifact = await evidence.artifact(binding);
		preparation.session.assertProject(projectId);
		if (context.signal.aborted) throw new RunCancelled();
		return verifiedArtifact(artifact, capture);
	};
}

function threadView(context: RunContext) {
	const thread = context.entity.threads.find((item) => item.id === context.request.threadId);
	return { state: thread?.state ?? 'default', viewport: thread?.viewport ?? 'desktop' };
}

function verifiedArtifact(
	artifact: Awaited<ReturnType<RecordedEvidenceService['artifact']>>,
	capture: NonNullable<ReturnType<typeof selectCapture>>['capture']
): Uint8Array {
	const bytes = new Uint8Array(artifact.bytes);
	if (
		artifact.sha256 !== capture.sha256 ||
		artifact.mediaType !== capture.mediaType ||
		createHash('sha256').update(bytes).digest('hex') !== capture.sha256 ||
		!imageBytes(bytes, artifact.mediaType)
	)
		throw new Error('Current screenshot evidence failed integrity verification.');
	return bytes;
}

function validateEvidenceIdentity(result: EntityEvidenceResult, query: EntityEvidenceQuery) {
	if (
		result.identity.projectId !== query.projectId ||
		result.identity.sourceCommit !== query.commit ||
		result.scope.commit !== query.commit ||
		result.scope.branch !== query.branch ||
		result.evidence.after.commit !== query.commit ||
		result.scope.mode !== 'commit' ||
		result.evidence.mode !== 'commit'
	)
		throw new Error('Current screenshot evidence is stale or belongs to another project.');
}

function selectCapture(result: EntityEvidenceResult, state: string, viewport: string) {
	const side = result.evidence.after;
	if (!side.record) return null;
	if (!side.record.valid || side.record.source.commit !== side.commit)
		throw new Error('Current screenshot evidence has an invalid source record.');
	const eligible = side.captures.filter(
		(item) =>
			item.current &&
			item.usable &&
			!item.focused &&
			item.inheritedFrom === null &&
			item.standing === 'fresh' &&
			item.state === state &&
			item.capture.state === state &&
			item.capture.viewport === viewport &&
			item.capture.kind === 'screenshot' &&
			item.capture.status === 'passed'
	);
	eligible.sort((left, right) =>
		JSON.stringify([left.scenario, left.capture.evidence, left.capture.sha256]).localeCompare(
			JSON.stringify([right.scenario, right.capture.evidence, right.capture.sha256])
		)
	);
	const selected = eligible[0];
	if (selected && !/^[a-f0-9]{64}$/.test(selected.capture.sha256))
		throw new Error('Current screenshot evidence has an invalid image hash.');
	return selected ?? null;
}

function imageBytes(bytes: Uint8Array, mediaType: string): boolean {
	if (!bytes.byteLength || bytes.byteLength > 11 * 1024 * 1024) return false;
	if (mediaType === 'image/png')
		return Buffer.from(bytes.subarray(0, 8)).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
	if (mediaType === 'image/jpeg') return bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
	if (mediaType === 'image/webp')
		return (
			Buffer.from(bytes.subarray(0, 4)).toString() === 'RIFF' &&
			Buffer.from(bytes.subarray(8, 12)).toString() === 'WEBP'
		);
	return false;
}
