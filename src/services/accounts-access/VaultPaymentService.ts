// @harness-uid u_4hbuoweikr
import { randomBytes } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import type { VaultAuditEventName } from '../../repositories/accounts-access/VaultAuditRepository.types';
import { VaultBrokerError } from '../../validators/accounts-access/VaultBrokerError';
import {
	vaultPaymentCheckout,
	VaultPaymentValidator,
	vaultPurchaseRoutes
} from '../../validators/accounts-access/VaultPaymentValidator';
import { vaultRequestLimits } from './VaultBrokerService';
import type {
	VaultPaymentDependencies,
	VaultPaymentEntry,
	VaultPaymentOffer
} from './VaultPaymentService.types';

const wire = new VaultPaymentValidator();

/** Broker-private approval state. Only the protected executor may create or claim an offer. */
export class VaultPaymentService {
	private enabled = false;
	private readonly requests = new Map<string, VaultPaymentEntry>();

	constructor(private readonly dependencies: VaultPaymentDependencies) {}

	setEnabled(enabled: boolean): void {
		this.enabled = enabled;
		if (enabled) return;
		const revoked = [...this.requests.values()];
		this.requests.clear();
		for (const { offer } of revoked) this.record(offer, 'revoke', 'disabled');
	}

	request(input: unknown): VaultPaymentOffer {
		this.requireEnabled();
		const scope = wire.scope(input);
		for (const requestId of this.requests.keys()) this.active(requestId);
		if (this.requests.size >= vaultRequestLimits.queue) {
			throw new VaultBrokerError(429, 'The purchase queue is full.');
		}
		const requestId = randomBytes(16).toString('hex');
		const offer = {
			requestId,
			scope,
			expiresAt: this.dependencies.now() + vaultRequestLimits.offerMs
		};
		this.record(offer, 'request');
		this.requests.set(requestId, { offer });
		return globalThis.structuredClone(offer);
	}

	queue(input: unknown): VaultPaymentOffer[] {
		this.dependencies.devices.authenticate(vaultPurchaseRoutes.queue, wire.proof(input));
		const offers: VaultPaymentOffer[] = [];
		for (const requestId of this.requests.keys()) {
			const entry = this.active(requestId);
			if (entry && entry.approvalExpiresAt === undefined)
				offers.push(globalThis.structuredClone(entry.offer));
		}
		return offers;
	}

	decide(input: unknown): 'approved' | 'denied' {
		this.requireEnabled();
		const proof = wire.proof(input);
		this.dependencies.devices.authenticate(vaultPurchaseRoutes.decision, proof);
		const decision = wire.decision(proof.payload);
		const entry = this.active(decision.requestId);
		if (!entry || entry.approvalExpiresAt !== undefined) throw unavailable();
		if (decision.decision === 'deny') {
			this.requests.delete(decision.requestId);
			this.record(entry.offer, 'denial');
			return 'denied';
		}
		if (!isDeepStrictEqual(decision.scope, entry.offer.scope)) {
			throw new VaultBrokerError(409, 'The purchase scope changed. Request a new approval.');
		}
		const now = this.dependencies.now();
		const deadline = Math.min(now + vaultRequestLimits.deliveryMs, entry.offer.expiresAt);
		if (decision.expiresAt <= now || decision.expiresAt > deadline) {
			throw new VaultBrokerError(409, 'The purchase approval window is invalid.');
		}
		this.record(entry.offer, 'approval');
		entry.approvalExpiresAt = decision.expiresAt;
		return 'approved';
	}

	/** Consumes the offer before any card data may reach the private checkout executor. */
	claim(requestId: string, checkout: unknown, runnerFingerprint: string): VaultPaymentOffer {
		this.requireEnabled();
		const entry = this.active(requestId);
		if (entry?.approvalExpiresAt === undefined) throw unavailable();
		const { offer } = entry;
		this.requests.delete(requestId);
		const verified = vaultPaymentCheckout.safeParse(checkout);
		if (
			!verified.success ||
			!isDeepStrictEqual(verified.data, offer.scope.checkout) ||
			runnerFingerprint !== offer.scope.runnerFingerprint
		) {
			this.record(offer, 'revoke', 'checkout-changed');
			throw new VaultBrokerError(409, 'Checkout changed. Request a new approval.');
		}
		this.record(offer, 'delivery');
		return { ...offer, expiresAt: entry.approvalExpiresAt };
	}

	private active(requestId: string): VaultPaymentEntry | undefined {
		const entry = this.requests.get(requestId);
		if (!entry) return undefined;
		if ((entry.approvalExpiresAt ?? entry.offer.expiresAt) > this.dependencies.now()) return entry;
		this.requests.delete(requestId);
		this.record(entry.offer, 'expiry');
		return undefined;
	}

	private record(offer: VaultPaymentOffer, event: VaultAuditEventName, cause?: string): void {
		this.dependencies.audit.append(
			{
				request: offer.requestId,
				item: offer.scope.item,
				site: offer.scope.checkout.merchant,
				action: 'pay',
				method: 'browser',
				recipeDigest: offer.scope.recipeDigest,
				host: this.dependencies.host,
				cause
			},
			event
		);
	}

	private requireEnabled(): void {
		if (!this.enabled) throw new VaultBrokerError(403, 'Vault purchases are disabled.');
	}
}

function unavailable(): VaultBrokerError {
	return new VaultBrokerError(409, 'Approval is unavailable.');
}
