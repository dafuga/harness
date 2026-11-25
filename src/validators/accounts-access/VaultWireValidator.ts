// @harness-uid u_23xwb3xbkg
import { z } from 'zod';
import { VaultBrokerError } from './VaultBrokerError';

const text = (limit: number) =>
	z
		.string()
		.min(1)
		.max(limit)
		.regex(/^[^\p{Cc}\p{Bidi_Control}]+$/u);
const identifier = z.string().regex(/^[a-z][a-z0-9-]{0,47}$/u);
const hex = (length: number) => z.string().regex(new RegExp('^[0-9a-f]{' + length + '}$', 'u'));
const timestamp = z.number().int().nonnegative();

/** Base64url without padding, decoding to between min and max bytes. */
export function binary(min: number, max = min) {
	return z
		.string()
		.max(Math.ceil((max * 4) / 3))
		.regex(/^[A-Za-z0-9_-]*$/u)
		.refine((value) => {
			const bytes = Buffer.from(value, 'base64url');
			return bytes.length >= min && bytes.length <= max && bytes.toString('base64url') === value;
		});
}

export const vaultMaxPlaintext = 8192;
export const vaultPasswordAction = 'generate-password';

const recipeRef = z.strictObject({
	site: identifier,
	revision: z.number().int().positive(),
	digest: hex(64)
});
const methodKind = z.enum(['api-token', 'oauth-device', 'browser']);
const mode = z.enum(['read', 'write']);

/** A preflighted request from a session; the runner key belongs to the fresh login runner. */
export const vaultSessionRequest = z.strictObject({
	item: z.string().regex(/^[a-z0-9]{6,40}$/u),
	session: text(100),
	project: identifier,
	environment: identifier,
	site: identifier,
	action: identifier,
	account: identifier,
	mode,
	method: methodKind,
	recipe: recipeRef,
	host: identifier,
	runnerPublicKey: binary(32),
	origins: z.array(z.string().url().max(255)).min(1).max(16),
	leaseMs: z.number().int().positive(),
	reason: text(500)
});

export const vaultTicket = z.strictObject({ requestId: hex(32), receipt: binary(32) });

export const vaultProof = z.strictObject({
	deviceId: identifier,
	nonce: binary(32),
	payload: binary(0, 350_000),
	signature: binary(64)
});

export const vaultSealed = z.strictObject({
	senderPublicKey: binary(32),
	salt: binary(32),
	ciphertext: binary(18, vaultMaxPlaintext + 16)
});

const binding = {
	requestId: hex(32),
	runnerFingerprint: hex(64),
	recipeDigest: hex(64)
};

/** The phone-signed decision; an approval restates every field of the scope it approves. */
export const vaultDecision = z.discriminatedUnion('decision', [
	z.strictObject({
		...binding,
		decision: z.literal('approve'),
		method: methodKind,
		mode,
		account: identifier,
		project: identifier.optional(),
		environment: identifier.optional(),
		session: text(100),
		action: identifier,
		host: identifier,
		leaseMs: z.number().int().positive(),
		otpIncluded: z.boolean(),
		expiresAt: timestamp,
		sealed: vaultSealed.nullable()
	}),
	z.strictObject({ ...binding, decision: z.literal('deny') })
]);

export const vaultChallenge = z.strictObject({ deviceId: identifier });
export const vaultLeaseCall = z.strictObject({ lease: hex(32), session: text(100) });
const path = z.string().max(255).nullable();
export const vaultLeaseIssue = vaultTicket.extend({
	identity: text(200),
	teardown: z.strictObject({ logout: path, revoke: path, securityLog: path })
});

/** Parses one untrusted broker message, failing with a field path but never the field's value. */
export class VaultWireValidator {
	parse<T>(schema: z.ZodType<T>, input: unknown, label: string): T {
		const result = schema.safeParse(input);
		if (result.success) return result.data;
		const where = result.error.issues[0]?.path.join('.') || label;
		throw new VaultBrokerError(400, 'Invalid ' + label + ' at ' + where + '.');
	}

	json<T>(schema: z.ZodType<T>, bytes: Uint8Array, label: string): T {
		let decoded: unknown;
		try {
			decoded = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
		} catch {
			throw new VaultBrokerError(400, 'Invalid ' + label + ': not UTF-8 JSON.');
		}
		return this.parse(schema, decoded, label);
	}
}
