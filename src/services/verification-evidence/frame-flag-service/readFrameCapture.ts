// @harness-uid u_zhz7hjx43x
import { ExpectedCliError } from '../../../core/development-tooling/errors';
import { notesRef } from '../../../core/git-source-history/historyTypes';
import { EvidenceBranchRepository } from '../../../repositories/verification-evidence/evidence-branch-repository/EvidenceBranchRepository';
import { HistoryStatusService } from '../history-status-service/HistoryStatusService';
import { VideoReferenceService } from '../VideoReferenceService';
import { owningFrameCapture } from './flagSchema';
import type { VerificationRecord } from '../../../core/verification-evidence/verificationTypes';
import type { FrameClipReference } from '../FrameFlagService.types';
import type {
	PinnedHistory,
	VerificationNote
} from '../history-status-service/HistoryStatusService.types';
import type { ReadFrameCapture, SelectedFrameCapture } from './readFrameCapture.types';

/** Archive clips prove only their selected objects; legacy inline clips retain whole-record proof. */
export async function readFrameCapture(
	root: string,
	reference: FrameClipReference,
	pinned?: PinnedHistory
): Promise<ReadFrameCapture> {
	const evidence = new EvidenceBranchRepository(root);
	const scope = pinned ?? {
		evidence: (await evidence.tip()) ?? null,
		notes: (await evidence.tree.tip(notesRef)) ?? null
	};
	const history = new HistoryStatusService(root, scope);
	const line = await frameRecordLine(history, reference);
	const descriptor = await history.attached.describe(line.evidence),
		record = descriptor.record;
	if (!record || descriptor.problems.length)
		throw new ExpectedCliError(`Invalid attached evidence: ${descriptor.problems.join('; ')}`);
	if (!frameRecordPassed(record, reference.unit))
		throw new ExpectedCliError('Clip record has not passed verification.');
	const capture = owningFrameCapture(record, reference);
	const bytes = capture.videoReference
		? await archivedFrameBytes(root, reference, { record, capture, pinned: scope })
		: await inlineFrameBytes(history, line, capture.path);
	if (bytes?.length !== capture.bytes)
		throw new ExpectedCliError('Attached video bytes are missing or corrupt.');
	return { capture, bytes };
}

async function frameRecordLine(
	history: HistoryStatusService,
	reference: FrameClipReference
): Promise<VerificationNote> {
	const note = (await history.all()).get(reference.revision);
	if (note?.problems.length) throw new ExpectedCliError(note.problems.join('; '));
	const lines = note?.entries.filter(
		(entry) => entry.kind === 'verification' && entry.record === reference.record
	);
	if (lines?.length !== 1 || lines[0].kind !== 'verification')
		throw new ExpectedCliError('Clip requires one matching attached verification record.');
	return lines[0];
}

async function archivedFrameBytes(
	root: string,
	reference: FrameClipReference,
	selected: SelectedFrameCapture
): Promise<Buffer | undefined> {
	const { record, capture, pinned } = selected;
	const trusted = await new VideoReferenceService(root, pinned).resolve({
		source: record.source,
		capture: {
			...capture,
			videoReference: {
				batch: capture.videoReference!.batch,
				record: reference.record,
				revision: reference.revision
			}
		},
		batches: record.videoBatches ?? []
	});
	return trusted.files.get(capture.path);
}

async function inlineFrameBytes(
	history: HistoryStatusService,
	line: VerificationNote,
	path: string
): Promise<Buffer | undefined> {
	const problems = await history.problems(line);
	if (problems.length)
		throw new ExpectedCliError(`Invalid attached evidence: ${problems.join('; ')}`);
	return (await history.attached.load(line.evidence)).files.get(path);
}

/** A successful focused record retains its explicit partial verdict. */
function frameRecordPassed(record: VerificationRecord, unit: string): boolean {
	const full = record.status === 'passed' && record.failures.length === 0;
	const scoped =
		record.failures.length === 1 &&
		record.failures[0] ===
			`Scoped to ${unit}: only its scenario states ran, so this record is partial and never a full pass.` &&
		record.tests.length > 0 &&
		record.tests.every((test) => test.status === 'passed') &&
		record.scenarios.length > 0 &&
		record.scenarios.every((scenario) => scenario.status === 'passed');
	return full || scoped;
}
