import { expect, test } from 'vitest';
import { recipeSchema } from '../../../src/utils/accounts-access/vaultRecipe';
import { vaultMethod } from '../../../src/utils/accounts-access/vaultMethod';
import { syntheticRecipe } from '../../support/credential-vault/recipe';

const recipe = recipeSchema.parse(
	syntheticRecipe({
		methods: [
			{
				kind: 'browser',
				actions: ['read-usage', 'read-roster'],
				reason: 'Console pages have no API.'
			},
			{ kind: 'oauth-device', actions: ['read-usage'], client: 'cli', scopes: ['usage:read'] },
			{ kind: 'api-token', actions: ['read-usage'], credential: 'usage-token' }
		]
	})
);

test('prefers an API token, then a device grant, whatever order the recipe lists', () => {
	const all = { 'api-token': true, 'oauth-device': true, browser: true } as const;
	expect(vaultMethod(recipe, 'read-usage', all)).toMatchObject({
		status: 'selected',
		method: { kind: 'api-token' }
	});
	const deviceOnly = recipeSchema.parse({
		...syntheticRecipe(),
		methods: recipe.methods.slice(0, 2)
	});
	expect(vaultMethod(deviceOnly, 'read-usage', all)).toMatchObject({
		method: { kind: 'oauth-device' }
	});
});

test('blocks instead of falling back to a browser when the preferred method is not ready', () => {
	const choice = vaultMethod(recipe, 'read-usage', {
		'api-token': 'No usage token is enrolled.',
		browser: true
	});
	expect(choice).toEqual({
		status: 'blocked',
		kind: 'api-token',
		reason: 'No usage token is enrolled.'
	});
	expect(vaultMethod(recipe, 'read-usage', { browser: true })).toMatchObject({
		status: 'blocked',
		kind: 'api-token'
	});
});

test('selects a browser login only when no API or device method covers the action', () => {
	expect(vaultMethod(recipe, 'read-roster', { browser: true })).toMatchObject({
		status: 'selected',
		method: { kind: 'browser' }
	});
	expect(vaultMethod(recipe, 'delete-org', { browser: true })).toMatchObject({
		status: 'unsupported'
	});
});
