// @harness-uid u_alfe4qnget
import { HistoryStatusService } from '../history-status-service/HistoryStatusService';
import { GitAdapter } from '../../../adapters/git-source-history/GitAdapter';
import { videoRecordPassed } from '../../../utils/development-tooling/record-lineage/videoLineage';
import { verificationNoteIdentity } from '../../../utils/verification-evidence/verificationNoteIdentity';
import { ExpectedCliError } from '../../../core/development-tooling/errors';
import { memoCatalog, scopeKey, metadataLimit } from './referenceCache';
import { referenceScope } from './origins';
import type {
	Capture,
	VerificationRecord
} from '../../../core/verification-evidence/verificationTypes';
import type {
	VideoReferenceCandidate,
	VideoReferenceContext,
	VideoReferenceSelection
} from '../VideoReferenceService.types';

/** Sealed attached descriptors only: proposals must still pass resolve and current input admission. */
export async function videoReferenceCandidates(
	root: string,
	selection: VideoReferenceSelection,
	context: VideoReferenceContext
): Promise<VideoReferenceCandidate[]> {
	const pinned = await referenceScope(root, context);
	const load = () => loadCatalog(root, { ...context, pinned });
	const catalog = context.memo
		? await memoCatalog(context.memo, scopeKey(pinned), load)
		: await load();
	return globalThis.structuredClone(
		catalog.filter((candidate) => selectedCapture(candidate.capture, selection))
	);
}

async function loadCatalog(
	root: string,
	context: VideoReferenceContext
): Promise<VideoReferenceCandidate[]> {
	const pinned = await referenceScope(root, context),
		history = new HistoryStatusService(root, pinned);

	const lines = (await history.verifications()).sort(
		(a, b) => b.finishedAt.localeCompare(a.finishedAt) || b.record.localeCompare(a.record)
	);
	let bytes = 0;
	const seen = new Set<string>(),
		candidates = new Map<string, VideoReferenceCandidate>(),
		git = new GitAdapter(root);
	for (const line of lines) {
		if (seen.has(line.record)) continue;
		seen.add(line.record);
		const descriptor = await history.attached.describe(line.evidence),
			record = descriptor.record;
		if (!record || descriptor.problems.length) continue;
		const tree = await git.attempt(['rev-parse', '--verify', `${line.source.commit}^{tree}`]);
		if (verificationNoteIdentity(record, line, tree).length) continue;
		for (const candidate of recordCandidates(record)) {
			const ref = candidate.capture.videoReference!,
				key = `${ref.record}:${candidate.capture.path}:${ref.batch}`;
			if (!candidates.has(key)) {
				candidates.set(key, candidate);
				bytes += Buffer.byteLength(JSON.stringify(candidate));
				if (bytes > metadataLimit)
					throw new ExpectedCliError('Video candidate metadata exceeds the 8 MiB bound.');
			}
		}
	}
	return [...candidates.values()];
}

function recordCandidates(record: VerificationRecord): VideoReferenceCandidate[] {
	return ownPassedCaptures(record).flatMap((capture) => candidateFor(record, capture) ?? []);
}

function candidateFor(
	record: VerificationRecord,
	capture: Capture
): VideoReferenceCandidate | undefined {
	if (!capture.video || !capture.videoReference || capture.status !== 'passed') return undefined;
	if (!videoRecordPassed(record, capture.video.unit)) return undefined;
	const reference = capture.videoReference;
	const pointers =
		record.videoBatches?.filter((pointer) => pointer.batch === reference.batch) ?? [];
	if (pointers.length !== 1) return undefined;
	return {
		capture: {
			...globalThis.structuredClone(capture),
			videoReference: {
				batch: reference.batch,
				record: reference.record ?? record.id,
				revision: reference.revision ?? record.source.commit
			}
		},
		batches: [pointers[0]],
		parent: { record: record.id, revision: record.source.commit }
	};
}

function ownPassedCaptures(record: VerificationRecord): Capture[] {
	return record.scenarios
		.filter(
			(scenario) => scenario.status === 'passed' && scenario.testedRevision === record.source.commit
		)
		.flatMap((scenario) => scenario.states.flatMap((state) => state.captures));
}

function selectedCapture(capture: Capture, selection: VideoReferenceSelection): boolean {
	const video = capture.video;
	if (!video || !capture.videoReference) return false;
	return [
		capture.status === 'passed',
		video.unit === selection.unit,
		video.clipId === selection.clipId,
		capture.viewport === selection.viewport,
		video.inputHash === selection.inputHash
	].every(Boolean);
}
