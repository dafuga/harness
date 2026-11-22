import { createHash } from 'node:crypto';
import { expect, test, vi } from 'vitest';
import { VaultBrowserRecipeService } from '../../../src/services/accounts-access/VaultBrowserRecipeService';
import { vaultRecipe } from '../../../src/utils/accounts-access/vaultRecipe';
import { reviewed, syntheticRecipe } from '../../support/credential-vault/recipe';

function fixture() {
	const script = Buffer.from(
		JSON.stringify({
			steps: [
				{
					path: '/login',
					next: '/verify',
					field: 'password',
					input: '#password',
					submit: '#continue'
				},
				{ path: '/verify', next: '/roster', field: 'otp', input: '#otp', submit: '#verify' }
			],
			identity: '#identity',
			capability: '#capability'
		})
	);
	const scriptSha256 = createHash('sha256').update(script).digest('hex');
	const input = syntheticRecipe({
		methods: [
			{ kind: 'browser', actions: ['read-roster'], reason: 'No roster API exists.', scriptSha256 }
		],
		actions: [{ id: 'read-roster', mode: 'read', start: '/roster' }],
		login: [
			{ id: 'password', url: '/login' },
			{ id: 'otp', url: '/verify' }
		]
	});
	const { review, reviewers } = reviewed(input, Date.now());
	const recipe = vaultRecipe(input, review, reviewers);
	const approval = {
		recipeDigest: recipe.digest,
		action: 'read-roster',
		method: 'browser' as const
	};
	return { recipe, approval, script };
}

test('run rejects changed script bytes before opening the sealed secret or a page', async () => {
	const input = fixture();
	const openSecret = vi.fn(() => Buffer.alloc(0));
	const newPage = vi.fn();
	const service = new VaultBrowserRecipeService({ newPage, openSecret });
	await expect(service.run({ ...input, script: Buffer.from('{}') })).rejects.toThrow(
		'reviewed script digest'
	);
	expect(openSecret).not.toHaveBeenCalled();
	expect(newPage).not.toHaveBeenCalled();
});
