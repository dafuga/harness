// @harness-uid u_alfe4qnget
import { ExpectedCliError } from '../../../core/development-tooling/errors';
import { notesRef } from '../../../core/git-source-history/historyTypes';
import { EvidenceBranchRepository } from '../../../repositories/verification-evidence/evidence-branch-repository/EvidenceBranchRepository';
import { HistoryStatusService } from '../history-status-service/HistoryStatusService';
import { GitAdapter } from '../../../adapters/git-source-history/GitAdapter';
import { VideoArchiveService } from '../VideoArchiveService';
import { verificationNoteIdentity } from '../../../utils/verification-evidence/verificationNoteIdentity';
import { memoOrigin, originKey } from './referenceCache';
import type { VideoOriginRecord } from '../../../utils/development-tooling/recordLineage.types';
import {
	originalVideoCapture,
	sameVideoCapture,
	videoRecordPassed
} from '../../../utils/development-tooling/record-lineage/videoLineage';
import type {
	PinnedHistory,
	VerificationNote
} from '../history-status-service/HistoryStatusService.types';
import type { Capture } from '../../../core/verification-evidence/verificationTypes';
import type { VideoReferenceContext, VideoOriginProof } from '../VideoReferenceService.types';

export async function referenceScope(
	root: string,
	context: VideoReferenceContext
): Promise<PinnedHistory> {
	const evidence = new EvidenceBranchRepository(root),
		supplied = context.pinned;
	return {
		evidence: supplied ? supplied.evidence : ((await evidence.tip()) ?? null),
		notes:
			supplied?.notes === undefined ? ((await evidence.tree.tip(notesRef)) ?? null) : supplied.notes
	};
}

/** A sealed successful clip parent proves only its selected media; whole-record integrity stays separate. */
export async function proveOriginal(
	root: string,
	capture: Capture,
	context: VideoReferenceContext
): Promise<void> {
	const reference = capture.videoReference!;
	if (!reference.record) return;
	if (context.trail.includes(reference.record))
		throw new ExpectedCliError('Inherited video records form a cycle.');
	const pinned = await referenceScope(root, context);
	const key = originKey(pinned, context.trail, reference.record, reference.revision!);
	const load = () => loadOriginal(root, capture, { ...context, pinned });
	const proof = context.memo ? await memoOrigin(context.memo, key, load) : await load();
	checkOriginal(proof.record, capture);
	const pointer = proof.record.videoBatches!.find((item) => item.batch === reference.batch)!;
	await new VideoArchiveService(root).describe(pointer, proof.evidenceCommit);
}

async function loadOriginal(
	root: string,
	capture: Capture,
	context: VideoReferenceContext
): Promise<VideoOriginProof> {
	const pinned = await referenceScope(root, context);
	const history = new HistoryStatusService(root, pinned, {
		trail: context.trail,
		retainMedia: false
	});
	const line = await attachedOriginLine(history, capture);
	const descriptor = await history.attached.describe(line.evidence),
		parent = descriptor.record;
	const tree = await new GitAdapter(root).attempt([
		'rev-parse',
		'--verify',
		`${line.source.commit}^{tree}`
	]);
	const problems = [
		...descriptor.problems,
		...(parent
			? verificationNoteIdentity(parent, line, tree)
			: ['Original clip parent is unavailable.'])
	];
	if (problems.length)
		throw new ExpectedCliError(`Original clip parent integrity failed: ${problems.join('; ')}`);
	if (!parent || !videoRecordPassed(parent, capture.video!.unit))
		throw new ExpectedCliError('Original clip parent did not pass for its exact owner/scope.');
	checkOriginal(parent, capture);
	return { record: originProjection(parent), evidenceCommit: line.evidence.commit };
}

function checkOriginal(parent: VideoOriginRecord, capture: Capture): void {
	if (!videoRecordPassed(parent, capture.video!.unit))
		throw new ExpectedCliError('Original clip parent did not pass for its exact owner/scope.');
	const original = originalVideoCapture(parent, capture);
	if (
		!original ||
		!sameVideoCapture(original, capture) ||
		!originalBatchMatches(parent, original, capture)
	)
		throw new ExpectedCliError('Reused clip metadata differs from its original attached capture.');
}

function originalBatchMatches(
	parent: VideoOriginRecord,
	original: Capture,
	capture: Capture
): boolean {
	return (
		!original.videoReference?.record &&
		original.videoReference?.batch === capture.videoReference?.batch &&
		parent.videoBatches?.filter((pointer) => pointer.batch === capture.videoReference?.batch)
			.length === 1
	);
}

function originProjection(parent: VideoOriginRecord): VideoOriginRecord {
	return {
		id: parent.id,
		source: parent.source,
		status: parent.status,
		failures: parent.failures,
		components: parent.components.map(({ unit, change }) => ({ unit, change })),
		tests: parent.tests.map(({ status }) => ({ status })),
		...(parent.builds ? { builds: parent.builds.map(({ buildId }) => ({ buildId })) } : {}),
		...(parent.videoBatches ? { videoBatches: parent.videoBatches } : {}),
		scenarios: parent.scenarios.map(({ status, testedRevision, states }) => ({
			status,
			testedRevision,
			states: states.map(({ captures }) => ({ captures }))
		}))
	};
}

async function attachedOriginLine(
	history: HistoryStatusService,
	capture: Capture
): Promise<VerificationNote> {
	const reference = capture.videoReference!;
	const note = (await history.all()).get(reference.revision ?? '');
	if (note?.problems.length) throw new ExpectedCliError(note.problems.join('; '));
	const lines = note?.entries.filter(
		(entry) => entry.kind === 'verification' && entry.record === reference.record
	);
	if (lines?.length !== 1 || lines[0].kind !== 'verification')
		throw new ExpectedCliError('Original clip requires one attached parent record.');
	return lines[0];
}
