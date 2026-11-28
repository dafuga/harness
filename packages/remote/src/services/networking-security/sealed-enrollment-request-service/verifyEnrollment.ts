// @harness-uid u_uc636z6tgg
import { SealedError } from '../../../models/networking-security/SealedError';
import { fromBase64Url, toBase64Url } from '../../../utils/networking-security/remoteBytes';
import { sealedChain } from '../../../utils/networking-security/sealedChain';
import { openSealedGrant } from '../../../utils/networking-security/sealedGrant';
import type {
	EnrollmentTransportOptions,
	MailboxStep
} from '../SealedEnrollmentReviewService.types';
import type {
	ApprovedInstallation,
	EnrollmentProgress
} from '../SealedEnrollmentRequestService.types';
import {
	enrollmentEntries,
	enrollmentGrants,
	stepMatches
} from '../sealed-enrollment-review-service/reviewTransport';

export async function pinEnrollmentClaim(
	options: EnrollmentTransportOptions,
	claim: MailboxStep,
	progress: EnrollmentProgress & { mailbox: string }
) {
	const fields = JSON.parse(claim.body);
	const nonce = enrollmentNonceBytes(fields?.nonce);
	if (!stepMatches(claim, { approver: claim.by, nonce: toBase64Url(nonce) }))
		throw new SealedError('Invalid approval claim.');
	const prior = progress.claim;
	if (
		prior &&
		(prior.mailbox !== progress.mailbox ||
			prior.approver !== claim.by ||
			prior.nonce !== fields.nonce)
	)
		throw new SealedError('The approval claim changed.');
	const chain = await sealedChain(await enrollmentEntries(options), {
		account: options.account,
		pin: prior?.head ?? progress.accountPin
	});
	const admin = chain.devices[claim.by];
	if (
		!admin?.active ||
		admin.role !== 'admin' ||
		(prior && prior.signingPublic !== admin.signingPublic)
	)
		throw new SealedError('The approval claim is missing an active signer.');
	return (
		prior ?? {
			mailbox: progress.mailbox,
			approver: claim.by,
			nonce: fields.nonce as string,
			signingPublic: admin.signingPublic,
			head: { seq: chain.seq, head: chain.head }
		}
	);
}

export async function verifyEnrollmentAdmission(
	options: EnrollmentTransportOptions,
	progress: EnrollmentProgress
): Promise<ApprovedInstallation> {
	const { account, device } = options;
	const entries = await enrollmentEntries(options);
	const claim = progress.claim;
	const chain = await sealedChain(entries, {
		account,
		pin: progress.pin ?? claim?.head ?? progress.accountPin
	});
	const enrolled = chain.devices[device.deviceId];
	if (
		!enrolled?.active ||
		enrolled.role !== 'admin' ||
		enrolled.kemPublic !== toBase64Url(device.kemPublic) ||
		enrolled.signingPublic !== toBase64Url(device.signingPublic) ||
		!enrolled.scopes.length
	)
		throw new SealedError('The local device is missing from the signed account history.');
	if (
		!progress.pin &&
		(claim
			? !entries.some(
					(entry) =>
						entry.seq > claim.head.seq &&
						entry.by === claim.approver &&
						entry.body.type === 'enroll' &&
						entry.body.device.deviceId === device.deviceId
				) || chain.devices[claim.approver]?.signingPublic !== claim.signingPublic
			: entries[0].by !== device.deviceId)
	)
		throw new SealedError('Approval did not come from the verified device request.');
	const grants = await enrollmentGrants(options);
	const keys = await Promise.all(
		enrolled.scopes.map((scope) => {
			const grant = grants.find(
				(value) => value.scope === scope && value.epoch === chain.scopes[scope].epoch
			);
			if (!grant) throw new SealedError('A current grant is missing.');
			return openSealedGrant(grant, device, chain);
		})
	);
	return { state: 'approved', pin: { seq: chain.seq, head: chain.head }, keys };
}

export function enrollmentNonceBytes(value: string): Uint8Array {
	if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(value))
		throw new SealedError('Invalid approval nonce.');
	const bytes = fromBase64Url(value);
	if (bytes.length !== 32 || toBase64Url(bytes) !== value)
		throw new SealedError('Invalid approval nonce.');
	return bytes;
}
