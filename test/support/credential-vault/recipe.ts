import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import {
	recipeDigest,
	recipeSchema,
	reviewSigningInput,
	vaultRecipe
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
			{ id: 'read-usage', mode: 'read', start: '/usage' },
			{ id: 'read-roster', mode: 'read', start: '/orgs/acme/members' }
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

export function signedFixtureRecipe(capture: boolean) {
	const input = JSON.parse(
		readFileSync('deploy/vault/recipes/example-console.json', 'utf8')
	) as VaultRecipeInput;
	const original = readFileSync('deploy/vault/recipes/example-console.browser.json');
	const script = capture ? captureRecipe(input, original) : original;
	const { review, reviewers } = reviewed(input, Date.now());
	return { recipe: vaultRecipe(input, review, reviewers), script };
}

export function signupFixtureRecipe() {
	const script = Buffer.from(
		JSON.stringify({
			identity: '#identity',
			password: '#password',
			confirmation: '#confirm',
			submit: '#signup',
			post: '/signup',
			result: '/registered',
			verifiedIdentity: '#registered'
		})
	);
	const input = syntheticRecipe({
		redirects: [],
		login: [],
		otp: [],
		actions: [{ id: 'generate-password', mode: 'write', start: '/signup' }],
		methods: [
			{
				kind: 'browser',
				actions: ['generate-password'],
				reason: 'Synthetic signup has no API.',
				scriptSha256: createHash('sha256').update(script).digest('hex')
			}
		]
	});
	const { review, reviewers } = reviewed(input, Date.now());
	return { input, script, review, reviewers, recipe: vaultRecipe(input, review, reviewers) };
}

function captureRecipe(input: VaultRecipeInput, original: Buffer): Buffer {
	const script = JSON.parse(original.toString());
	script.steps.at(-1).next = '/capture';
	script.capture = { trigger: '#generate', result: '/created', value: '#generated' };
	const program = Buffer.from(JSON.stringify(script));
	input.actions = [{ id: 'capture-secret', mode: 'write', start: '/capture' }];
	input.methods = [
		{
			kind: 'browser',
			actions: ['capture-secret'],
			reason: 'Synthetic browser capture action.',
			scriptSha256: createHash('sha256').update(program).digest('hex')
		}
	];
	return program;
}
