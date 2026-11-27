// @harness-uid u_r4ajdppn52
import { SealedError } from '../../models/networking-security/SealedError';
import type {
	SealedChainPin,
	SealedChainState
} from '../../models/networking-security/Sealed.types';
import {
	cryptoSource,
	fromBase64Url,
	toBase64Url
} from '../../utils/networking-security/remoteBytes';
import { chainEntryHash, sealedChainEntry } from '../../utils/networking-security/sealedChainEntry';
import { rewrapSealedGrant } from '../../utils/networking-security/sealedGrant';
import { checkEnrollCommit, sealedSas } from '../../utils/networking-security/sealedSas';
import { ReviewTransport, stepMatches } from './sealed-enrollment-review-service/reviewTransport';
import type {
	EnrollmentOpening,
	EnrollmentPublication,
	EnrollmentReviewOptions,
	MailboxStep
} from './SealedEnrollmentReviewService.types';

/** One review on one signed-in installation. Keep this instance from claim through user consent. */
export class SealedEnrollmentReviewService {
	private readonly hub: ReviewTransport;
	private readonly nonce = crypto.getRandomValues(new Uint8Array(32));
	private opening?: MailboxStep;
	private code?: string;
	private publication?: EnrollmentPublication;
	private deciding = false;

	constructor(
		private readonly options: EnrollmentReviewOptions,
		id: string
	) {
		this.hub = new ReviewTransport(options, id);
	}

	async claim(): Promise<void> {
		const steps = await this.hub.mailbox();
		const first = steps[0],
			self = this.options.device;
		if (steps.length > 1 && (!this.opening || !this.matchesClaim(steps[1])))
			throw new SealedError('Another review already claimed this request.');
		// Pin the first opening before any asynchronous verification or claim can reveal our nonce.
		if (this.opening && !sameOpening(first, this.opening))
			throw new SealedError('The device request changed.');
		this.opening = first;
		const chain = await this.hub.chain();
		assertAdmin(this.options, chain, first.by);
		await openingKeys(first);
		if (steps.length === 1)
			await this.hub.append(1, { approver: self.deviceId, nonce: toBase64Url(this.nonce) });
	}

	async comparison(): Promise<string | null> {
		const opening = this.opening;
		if (!opening) throw new SealedError('Claim the request before comparing codes.');
		const [first, claim, reveal] = await this.hub.mailbox();
		if (!sameOpening(first, opening) || !claim || !this.matchesClaim(claim))
			throw new SealedError('The device request changed.');
		if (!reveal) return null;
		const keys = await openingKeys(opening),
			nonce = decoded(JSON.parse(reveal.body).nonce, 32);
		if (reveal.by !== first.by || !(await checkEnrollCommit(keys, nonce, keys.commit)))
			throw new SealedError('The enrollment reveal does not match this request.');
		this.code = await sealedSas({
			request: keys,
			requestNonce: nonce,
			approverSigningPublic: this.options.device.signingPublic,
			approverNonce: this.nonce
		});
		return this.code;
	}

	async approve(
		displayed: string,
		authenticate: () => Promise<boolean>
	): Promise<SealedChainPin | null> {
		if (this.deciding || !this.opening || !this.code || displayed !== this.code)
			throw new SealedError('Compare this request on both devices before approving.');
		this.deciding = true;
		try {
			if ((await this.comparison()) !== displayed) throw new SealedError('The comparison changed.');
			if (!this.publication) {
				if (!(await authenticate())) return null;
				if ((await this.comparison()) !== displayed)
					throw new SealedError('The comparison changed.');
				this.publication = await preparePublication(this.hub, this.options, this.opening);
			}
			const { entry, grants, pin } = this.publication;
			const result = await this.hub.publish(entry, grants);
			if (result.seq !== pin.seq || result.hash !== pin.head)
				throw new SealedError('The published enrollment does not match.');
			await this.hub.append(3, { entryHash: pin.head });
			return { ...pin };
		} finally {
			this.deciding = false;
		}
	}

	async deny(): Promise<void> {
		if (this.deciding || this.publication)
			throw new SealedError('Approval is already in progress.');
		this.deciding = true;
		try {
			await this.hub.deny();
		} finally {
			this.deciding = false;
		}
	}

	private matchesClaim(step: MailboxStep): boolean {
		const approver = this.options.device.deviceId;
		return step.by === approver && stepMatches(step, { approver, nonce: toBase64Url(this.nonce) });
	}
}

async function preparePublication(
	hub: ReviewTransport,
	options: EnrollmentReviewOptions,
	opening: MailboxStep
): Promise<EnrollmentPublication> {
	const chain = await hub.chain(),
		signer = options.device;
	const scopes = assertAdmin(options, chain, opening.by);
	const { kemPublic, signingPublic } = JSON.parse(opening.body) as EnrollmentOpening;
	const device = {
		deviceId: opening.by,
		kemPublic,
		signingPublic,
		role: 'admin' as const,
		scopes
	};
	const held = await hub.grants();
	const grants = await Promise.all(
		scopes.map((scope) => {
			const grant = held.find(
				(g) =>
					g.device === signer.deviceId && g.scope === scope && g.epoch === chain.scopes[scope].epoch
			);
			if (!grant) throw new SealedError('A current grant is missing.');
			return rewrapSealedGrant(grant, signer, chain, device);
		})
	);
	options.signal.throwIfAborted();
	const entry = await sealedChainEntry(signer, {
		seq: chain.seq + 1,
		prev: chain.head,
		at: Date.now(),
		by: signer.deviceId,
		body: { type: 'enroll', device }
	});
	return { entry, grants, pin: { seq: entry.seq, head: await chainEntryHash(entry) } };
}

function assertAdmin(
	options: EnrollmentReviewOptions,
	chain: SealedChainState,
	recipient: string
): string[] {
	const self = options.device,
		admin = chain.devices[self.deviceId];
	if (
		!admin?.active ||
		admin.role !== 'admin' ||
		admin.kemPublic !== toBase64Url(self.kemPublic) ||
		admin.signingPublic !== toBase64Url(self.signingPublic) ||
		chain.devices[recipient] ||
		!admin.scopes.length ||
		admin.scopes.some((scope) => !chain.scopes[scope] || chain.scopes[scope].stale)
	)
		throw new SealedError('Device enrollment requires an active admin with current scope keys.');
	return [...admin.scopes].sort();
}

function sameOpening(a: MailboxStep, b: MailboxStep): boolean {
	return a.by === b.by && a.body === b.body;
}

function decoded(value: string, length: number): Uint8Array {
	const bytes = fromBase64Url(value);
	if (bytes.length !== length || toBase64Url(bytes) !== value)
		throw new SealedError('Invalid enrollment field.');
	return bytes;
}

async function openingKeys(step: MailboxStep) {
	decoded(step.by, 16);
	const fields = JSON.parse(step.body) as EnrollmentOpening;
	if (typeof fields.commit !== 'string' || !/^[0-9a-f]{64}$/.test(fields.commit))
		throw new SealedError('Invalid enrollment commitment.');
	const kemPublic = decoded(fields.kemPublic, 65),
		signingPublic = decoded(fields.signingPublic, 65);
	await Promise.all(
		[kemPublic, signingPublic].map((key) =>
			crypto.subtle.importKey(
				'raw',
				cryptoSource(key),
				{ name: 'ECDSA', namedCurve: 'P-256' },
				false,
				['verify']
			)
		)
	);
	return { kemPublic, signingPublic, commit: fields.commit };
}
