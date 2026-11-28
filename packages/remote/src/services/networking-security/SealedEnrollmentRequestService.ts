// @harness-uid u_4uztsikiqd
import { SealedError } from '../../models/networking-security/SealedError';
import { fromBase64Url, toBase64Url } from '../../utils/networking-security/remoteBytes';
import { readSealedDeviceSession } from '../../utils/networking-security/readSealedDeviceSession';
import { sealedEnrollCommit, sealedSas } from '../../utils/networking-security/sealedSas';
import type {
	EnrollmentMailbox,
	EnrollmentTransportOptions,
	MailboxStep
} from './SealedEnrollmentReviewService.types';
import type {
	ApprovedInstallation,
	EnrollmentClaimPin,
	EnrollmentProgress,
	EnrollmentResolution,
	KeepEnrollmentProgress
} from './SealedEnrollmentRequestService.types';
import {
	assertMailbox,
	enrollmentResponse,
	readEnrollment,
	sendEnrollment,
	stepMatches
} from './sealed-enrollment-review-service/reviewTransport';

import {
	enrollmentNonceBytes,
	pinEnrollmentClaim,
	verifyEnrollmentAdmission
} from './sealed-enrollment-request-service/verifyEnrollment';

export class SealedEnrollmentRequestService {
	constructor(private readonly options: EnrollmentTransportOptions) {}

	/** Resolve a session from the installation's durable state. Serialize calls per installation. */
	async resolve(
		progress: EnrollmentProgress,
		keep: KeepEnrollmentProgress
	): Promise<EnrollmentResolution> {
		const { request, device, signal } = this.options;
		let verified: ApprovedInstallation | undefined;
		const state = await readSealedDeviceSession(request, device, signal, async () => {
			verified = await verifyEnrollmentAdmission(this.options, progress);
			signal.throwIfAborted();
			if (verified.pin.head !== progress.pin?.head) await keep({ ...progress, pin: verified.pin });
		});
		if (state === 'first-device') return { state };
		if (state === 'waiting-for-approval') return this.wait(progress, keep);
		if (!verified) throw new SealedError('Device approval was not verified.');
		signal.throwIfAborted();
		return verified;
	}

	private async wait(
		progress: EnrollmentProgress,
		keep: KeepEnrollmentProgress
	): Promise<EnrollmentResolution> {
		const { device, signal } = this.options;
		const opening = {
			kemPublic: toBase64Url(device.kemPublic),
			signingPublic: toBase64Url(device.signingPublic),
			commit: await sealedEnrollCommit(device, progress.nonce)
		};
		const response = progress.mailbox
			? await sendEnrollment(this.options, 'enroll/' + progress.mailbox)
			: await sendEnrollment(this.options, 'enroll', { ...opening, platform: 'web' });
		if (progress.mailbox && response.status === 404) {
			await response.body?.cancel();
			return { state: 'approval-expired' };
		}
		const view = await enrollmentResponse<EnrollmentMailbox>(response, signal);
		assertMailbox(view, progress.mailbox);
		const [first, claim, reveal] = view.steps;
		if (first.by !== device.deviceId || !stepMatches(first, opening))
			throw new SealedError('The device request changed.');
		if (view.denied === true) return { state: 'approval-denied' };
		const next = { ...progress, mailbox: view.id };
		if (!claim) {
			if (progress.claim) throw new SealedError('The approval claim disappeared.');
			if (!progress.mailbox) await keep(next);
			return { state: 'waiting-for-approval', code: null };
		}
		const pinned = await pinEnrollmentClaim(this.options, claim, next);
		if (!progress.claim) {
			if (reveal)
				throw new SealedError('The device request was revealed before a claim was saved.');
			await keep({ ...next, claim: pinned });
		}
		return {
			state: 'waiting-for-approval',
			code: await this.reveal(progress.nonce, pinned, reveal)
		};
	}

	private async reveal(nonce: Uint8Array, claim: EnrollmentClaimPin, kept?: MailboxStep) {
		const fields = { nonce: toBase64Url(nonce) };
		const step =
			kept ?? (await readEnrollment<MailboxStep>(this.options, 'enroll/' + claim.mailbox, fields));
		if (step.n !== 2 || step.by !== this.options.device.deviceId || !stepMatches(step, fields))
			throw new SealedError('The Hub did not confirm the enrollment reveal.');
		return sealedSas({
			request: this.options.device,
			requestNonce: nonce,
			approverSigningPublic: fromBase64Url(claim.signingPublic),
			approverNonce: enrollmentNonceBytes(claim.nonce)
		});
	}
}
