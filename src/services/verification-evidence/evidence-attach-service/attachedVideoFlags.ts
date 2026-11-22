// @harness-uid u_rfumv65ikl
import type {
	Capture,
	VerificationRecord
} from '../../../core/verification-evidence/verificationTypes';
import { attachedVideoFlagFailure } from './attachedVideoFlagChecks';
import { FrameFlagService } from '../FrameFlagService';
import { readFrameFlags } from '../frame-flag-service/flagStore';
import { ExpectedCliError } from '../../../core/development-tooling/errors';
import type { Attached } from './EvidenceAttachService.types';

/** Notes and canonical media exist before this hook may append reviewer resolutions. */
export async function resolveAttachedVideoFlags(
	root: string,
	record: VerificationRecord
): Promise<void> {
	const captures = record.scenarios
		.filter(
			(scenario) =>
				scenario.status === 'passed' &&
				scenario.testedRevision === record.source.commit &&
				!scenario.referencedRecord
		)
		.flatMap((scenario) => scenario.states.flatMap((state) => state.captures))
		.filter(
			(capture) =>
				capture.kind === 'video' &&
				capture.status === 'passed' &&
				capture.video &&
				eligibleVideoRecord(record, capture.video.unit)
		);
	if (!captures.length) return;
	let flags = await readFrameFlags(root);
	for (const capture of captures) assertAttachedVideoFlags(record, capture, flags);
	const service = new FrameFlagService(root);
	for (const capture of captures)
		if (!capture.videoReference?.record && capture.video!.addressedFlags?.length)
			await service.address({
				record: record.id,
				revision: record.source.commit,
				unit: capture.video!.unit,
				clipId: capture.video!.clipId,
				viewport: capture.viewport!
			});
	flags = await readFrameFlags(root);
	for (const capture of captures) assertAttachedVideoFlags(record, capture, flags);
}
export function eligibleVideoRecord(record: VerificationRecord, unit: string): boolean {
	if (
		!record.components.some((component) => component.unit === unit) ||
		!record.tests.length ||
		record.tests.some((test) => test.status !== 'passed')
	)
		return false;
	if (
		record.scenarios.some(
			(scenario) => scenario.status !== 'passed' && scenario.status !== 'referenced'
		)
	)
		return false;
	if (record.status === 'passed' && record.failures.length === 0) return true;
	return (
		record.failures.length === 1 &&
		record.failures[0] ===
			`Scoped to ${unit}: only its scenario states ran, so this record is partial and never a full pass.`
	);
}
function assertAttachedVideoFlags(
	record: VerificationRecord,
	capture: Capture,
	flags: Awaited<ReturnType<typeof readFrameFlags>>
): void {
	const failure = attachedVideoFlagFailure(record.id, capture, flags);
	if (failure) throw new ExpectedCliError(failure);
}

export async function resolvedVideoAttachment(
	root: string,
	record: VerificationRecord,
	attached: Attached
): Promise<Attached> {
	await resolveAttachedVideoFlags(root, record);
	return attached;
}
