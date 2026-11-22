import { describe, expect, test } from 'vitest';
import {
	digestDisplay,
	recipeDigest,
	recipeReviewMaxAgeMs,
	recipeSchema,
	vaultRecipe
} from '../../../src/utils/accounts-access/vaultRecipe';
import { reviewed, syntheticRecipe } from '../../support/credential-vault/recipe';

const now = Date.UTC(2026, 10, 22, 14);

describe('vaultRecipe', () => {
	test('accepts a recipe signed by a trusted reviewer and shows its digest group', () => {
		const input = syntheticRecipe();
		const { review, reviewers } = reviewed(input, now - 60_000);
		const verified = vaultRecipe(input, review, reviewers, now);
		expect(verified.digest).toBe(recipeDigest(recipeSchema.parse(input)));
		expect(verified.display).toMatch(/^[0-9a-f]{4}( [0-9a-f]{4}){3}$/u);
		expect(verified.display).toBe(digestDisplay(verified.digest));
	});

	test('rejects a recipe changed after review', () => {
		const input = syntheticRecipe();
		const { review, reviewers } = reviewed(input, now);
		const changed = syntheticRecipe({
			origins: ['https://console.example.test', 'https://evil.example.test']
		});
		expect(() => vaultRecipe(changed, review, reviewers, now)).toThrow(
			/different site, revision or digest/u
		);
	});

	test('rejects an untrusted signer, a forged signature and a stale review', () => {
		const input = syntheticRecipe();
		const { review, reviewers } = reviewed(input, now);
		const other = reviewed(input, now);
		expect(() => vaultRecipe(input, review, other.reviewers, now)).toThrow(/trusted reviewer/u);
		expect(() => vaultRecipe(input, { ...review, reviewer: 'mallory' }, reviewers, now)).toThrow(
			/trusted reviewer/u
		);
		const stale = reviewed(input, now - recipeReviewMaxAgeMs - 1);
		expect(() => vaultRecipe(input, stale.review, stale.reviewers, now)).toThrow(/expired/u);
		expect(() => vaultRecipe(input, review, reviewers, now - 1)).toThrow(/future/u);
	});

	test('requires exact https origins, declared actions and browser teardown', () => {
		const bad = [
			syntheticRecipe({ origins: ['http://console.example.test'] }),
			syntheticRecipe({ origins: ['https://console.example.test/login'] }),
			syntheticRecipe({ origins: ['https://console.example.test:8443'] }),
			syntheticRecipe({
				methods: [{ kind: 'browser', actions: ['missing'], reason: 'No API for it.' }]
			}),
			syntheticRecipe({ teardown: { logout: null, revoke: null, securityLog: null } })
		];
		for (const input of bad) {
			const { review, reviewers } = reviewed(syntheticRecipe(), now);
			expect(() => vaultRecipe(input, review, reviewers, now)).toThrow(/Invalid recipe/u);
		}
	});
});
