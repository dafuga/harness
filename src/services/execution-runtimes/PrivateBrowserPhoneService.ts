// @harness-uid u_xwkimz47da
import { z } from 'zod';
import { ExpectedCliError } from '../../core/development-tooling/errors';
import { VaultSealAdapter } from '../../adapters/accounts-access/VaultSealAdapter';
import type { VaultChallenge } from '../../repositories/accounts-access/VaultDeviceRepository.types';
import {
	VaultWireValidator,
	binary,
	vaultMaxPlaintext,
	vaultSealed
} from '../../validators/accounts-access/VaultWireValidator';
import type {
	VaultProof,
	VaultSealed
} from '../../validators/accounts-access/VaultWireValidator.types';
import type {
	PendingPhoneOffer,
	PrivateBrowserFieldScope,
	PrivateBrowserPhoneConfig,
	PrivateBrowserPhoneOffer
} from './PrivateBrowserPhoneService.types';

export const privateBrowserPhonePaths = {
	challenge: '/v1/private-browser/challenge',
	offer: '/v1/private-browser/offer',
	submit: '/v1/private-browser/submit'
} as const;
const deliveryMs = 60_000;
const identifier = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/u);
const digest = z.string().regex(/^[a-f0-9]{64}$/u);
const fieldScope = {
	executor: identifier,
	origin: z
		.string()
		.max(255)
		.refine(
			(value) =>
				value.startsWith('https://') && URL.canParse(value) && new URL(value).origin === value
		),
	tabId: identifier,
	field: identifier,
	recipeDigest: digest,
	action: identifier
};
const submission = z.strictObject({
	...fieldScope,
	requestId: z.uuid(),
	runnerFingerprint: digest,
	expiresAt: z.number().int(),
	sealed: vaultSealed.extend({ ciphertext: binary(17, vaultMaxPlaintext + 16) })
});
const reviewedScope = z.strictObject(fieldScope);
const offerQuery = z.strictObject({});
const challengeRequest = z.strictObject({
	path: z.enum([privateBrowserPhonePaths.offer, privateBrowserPhonePaths.submit]),
	expiresAt: z.number().int()
});

/** Executor-side handoff for a single reviewed field, using the Vault's enrolled device and seal. */
export class PrivateBrowserPhoneService {
	private readonly now: () => number;
	private readonly wire = new VaultWireValidator();
	private pending?: PendingPhoneOffer;

	constructor(private readonly config: PrivateBrowserPhoneConfig) {
		this.now = config.now ?? Date.now;
	}

	/** Only the trusted executor calls offer, using a reviewed field and the observed tab. */
	offer(
		requestId: string,
		deviceId: string,
		scope: PrivateBrowserFieldScope
	): PrivateBrowserPhoneOffer | undefined {
		if (!this.config.gate.permitsInput(requestId, deviceId)) return undefined;
		if (this.pending?.offer.requestId === requestId) return undefined;
		const checked = reviewedScope.safeParse(scope);
		if (!checked.success) return undefined;
		scope = checked.data;
		const key = new VaultSealAdapter().runnerKey();
		const offer = {
			...scope,
			requestId,
			runnerPublicKey: key.publicKey,
			runnerFingerprint: key.fingerprint,
			expiresAt: this.now() + deliveryMs
		};
		this.pending = { offer, scope: { ...scope }, deviceId, key };
		return { ...offer };
	}

	challenge(proof: VaultProof): VaultChallenge {
		const { path, expiresAt } = this.wire.json(
			challengeRequest,
			Buffer.from(proof.payload, 'base64url'),
			'challenge request'
		);
		return this.config.devices.issueSigned(proof, {
			requestPath: privateBrowserPhonePaths.challenge,
			responsePath: path,
			expiresAt
		});
	}

	/** An enrolled device can discover only its own currently usable offer. */
	activeOffer(proof: VaultProof): PrivateBrowserPhoneOffer | undefined {
		this.config.devices.authenticate(privateBrowserPhonePaths.offer, proof);
		this.wire.json(offerQuery, Buffer.from(proof.payload, 'base64url'), 'offer query');
		const pending = this.pending;
		if (!pending || pending.deviceId !== proof.deviceId) return undefined;
		const { offer } = pending;
		if (
			this.now() >= offer.expiresAt ||
			!this.config.gate.permitsInput(offer.requestId, proof.deviceId)
		) {
			return undefined;
		}
		return { ...offer };
	}

	async submit(proof: VaultProof): Promise<boolean> {
		const pending = this.pending;
		if (pending?.deviceId !== proof.deviceId || this.now() >= pending.offer.expiresAt) return false;
		try {
			this.config.devices.authenticate(privateBrowserPhonePaths.submit, proof);
			const signed = this.wire.json(
				submission,
				Buffer.from(proof.payload, 'base64url'),
				'delivery'
			);
			const { sealed, ...scope } = signed;
			if (!matchesOffer(pending.offer, scope)) return false;
			this.pending = undefined;
			return await this.config.gate.nativeInput(scope.requestId, proof.deviceId, (signal) =>
				this.write(pending, sealed, signal)
			);
		} catch {
			return false;
		}
	}

	private async write(
		{ key, offer, scope }: PendingPhoneOffer,
		sealed: VaultSealed,
		signal: AbortSignal
	): Promise<void> {
		if (this.now() >= offer.expiresAt) throw new ExpectedCliError('Private delivery expired.');
		const plaintext = key.open(offer.requestId, sealed);
		try {
			await this.config.submitField(scope, plaintext, signal);
		} finally {
			plaintext.fill(0);
		}
	}
}

function matchesOffer(
	{ runnerPublicKey: _key, ...expected }: PrivateBrowserPhoneOffer,
	actual: Omit<PrivateBrowserPhoneOffer, 'runnerPublicKey'>
): boolean {
	return Object.entries(expected).every(
		([field, value]) => actual[field as keyof typeof actual] === value
	);
}
