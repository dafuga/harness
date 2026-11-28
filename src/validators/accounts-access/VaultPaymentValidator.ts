// @harness-uid u_uuanriimeu
import { z } from 'zod';
import { binary, vaultProof, VaultWireValidator } from './VaultWireValidator';
import type { VaultPaymentScope } from './VaultPaymentValidator.types';

const digest = z.string().regex(/^[a-f0-9]{64}$/u);
const opaqueId = z.string().regex(/^[a-f0-9]{32}$/u);
const description = z
	.string()
	.min(1)
	.max(200)
	.refine((text) => text.trim() === text && !/[\p{Cc}\p{Cf}]|(?:\p{Nd}[\p{Zs}-]*){13}/u.test(text));

export const vaultPaymentCheckout = z.strictObject({
	merchant: z.string().regex(/^[a-z][a-z0-9-]{0,47}$/u),
	origin: z.literal('https://checkout.stripe.com'),
	binding: digest,
	amountMinor: z.number().int().positive(),
	currency: z.string().regex(/^[A-Z]{3}$/u),
	mode: z.literal('stripe-test')
});

export const vaultPaymentScope = z.strictObject({
	item: z.string().regex(/^[a-z0-9]{6,40}$/u),
	session: z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/u),
	description,
	card: z.strictObject({ id: opaqueId, lastFour: z.string().regex(/^[0-9]{4}$/u) }),
	checkout: vaultPaymentCheckout,
	recipeDigest: digest,
	runnerFingerprint: digest
});

const vaultPaymentDecision = z.discriminatedUnion('decision', [
	z.strictObject({
		requestId: opaqueId,
		decision: z.literal('approve'),
		scope: vaultPaymentScope,
		expiresAt: z.number().int().nonnegative()
	}),
	z.strictObject({ requestId: opaqueId, decision: z.literal('deny') })
]);

export const vaultPurchaseProof = vaultProof.extend({ payload: binary(0, 4_096) });
export const vaultPurchaseRoutes = {
	queue: '/v1/device/purchase/requests',
	decision: '/v1/device/purchase/decision'
} as const;

export class VaultPaymentValidator extends VaultWireValidator {
	scope(input: unknown): VaultPaymentScope {
		return this.parse(vaultPaymentScope, input, 'purchase scope');
	}

	proof(input: unknown) {
		return this.parse(vaultPurchaseProof, input, 'purchase device proof');
	}

	decision(payload: string) {
		return this.json(vaultPaymentDecision, Buffer.from(payload, 'base64url'), 'purchase decision');
	}
}
