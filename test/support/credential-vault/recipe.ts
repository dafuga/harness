import { generateKeyPairSync, sign } from 'node:crypto';
import {
	recipeDigest,
	recipeSchema,
	reviewSigningInput
} from '../../../src/utils/accounts-access/vaultRecipe';
import type { VaultRecipeInput } from '../../../src/utils/accounts-access/vaultRecipe.types';

/** A synthetic recipe for a fictional site; it names no real provider. */
export function syntheticRecipe(overrides: Partial<VaultRecipeInput> = {}): VaultRecipeInput {
	return {
		schemaVersion: 1,
		site: 'example-console',
		revision: 3,
		account: { alias: 'synthetic-owner', identity: 'owner@example.test' },
		origins: ['https://console.example.test'],
		redirects: ['https://sso.example.test'],
		methods: [
			{ kind: 'api-token', actions: ['read-usage'], credential: 'usage-token' },
			{ kind: 'browser', actions: ['read-roster'], reason: 'The roster page has no API.' }
		],
		actions: [
			{ id: 'read-usage', mode: 'read', paths: ['/usage'] },
			{ id: 'read-roster', mode: 'read', paths: ['/orgs/*/members', '/orgs/*/teams/**'] }
		],
		otp: ['totp', 'email'],
		login: [{ id: 'password', url: '/login' }],
		teardown: { logout: '/logout', revoke: null, securityLog: 'audit-page' },
		timeouts: { loginMs: 180_000, leaseMs: 900_000 },
		...overrides
	};
}

/** Signs a review of the recipe with a throwaway Ed25519 key. */
export function reviewed(input: VaultRecipeInput, reviewedAt: number) {
	const { publicKey, privateKey } = generateKeyPairSync('ed25519');
	const recipe = recipeSchema.parse(input);
	const body = {
		site: recipe.site,
		revision: recipe.revision,
		digest: recipeDigest(recipe),
		reviewedAt
	};
	const signature = sign(null, reviewSigningInput(body), privateKey).toString('base64url');
	return {
		review: { ...body, reviewer: 'daniel', signature },
		reviewers: [
			{ id: 'daniel', publicKey: publicKey.export({ type: 'spki', format: 'pem' }).toString() }
		]
	};
}
