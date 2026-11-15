// @harness-uid u_alfe4qnget
import { ExpectedCliError } from '../../../core/development-tooling/errors';
import { notesRef } from '../../../core/git-source-history/historyTypes';
import { EvidenceBranchRepository } from '../../../repositories/verification-evidence/evidence-branch-repository/EvidenceBranchRepository';
import { HistoryStatusService } from '../history-status-service/HistoryStatusService';
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
import type { VideoReferenceContext } from '../VideoReferenceService.types';

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

/** A prior parent must be attached, intact through every dependency, and successful for this exact owner. */
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
	const history = new HistoryStatusService(root, pinned, {
		trail: context.trail,
		retainMedia: false
	});
	const line = await attachedOriginLine(history, capture);
	const problems = await history.problems(line);
	if (problems.length)
		throw new ExpectedCliError(`Original clip parent integrity failed: ${problems.join('; ')}`);
	const parent = (await history.attached.load(line.evidence)).record;
	if (!parent || !videoRecordPassed(parent, capture.video!.unit))
		throw new ExpectedCliError('Original clip parent did not pass for its exact owner/scope.');
	const original = originalVideoCapture(parent, capture);
	if (!original || !sameVideoCapture(original, capture))
		throw new ExpectedCliError('Reused clip metadata differs from its original attached capture.');
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
