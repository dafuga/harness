import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { composeHubAuth } from '../../src/lib/verification-evidence/server/auth/composeHubAuth';
import { AuthFailure } from '../../src/utils/accounts-access/authFail';
import type { HubAuthParts } from '../../src/utils/verification-evidence/composeHubAuth';

type Hub = ReturnType<typeof composeHubAuth>;

const ORIGIN = 'https://hub.example.test';
const NOW = 1_800_000_000_000;
const UNIT_ID = 'hub.function.compose-hub-auth';

function fixtureParts(): HubAuthParts {
	return {
		config: {
			clientId: 'fixture-client-id',
			secret: 'fixture-secret-0123456789abcdef',
			origin: ORIGIN,
			environment: 'production',
			github: null
		},
		store: {} as HubAuthParts['store'],
		google: {} as HubAuthParts['google'],
		fetch: (() => Promise.reject(new Error('network is disabled in this unit test'))) as typeof fetch,
		now: () => NOW,
		tokenCache: new Map(),
		delivery: null
	};
}

async function rejectionOf(pending: Promise<unknown>): Promise<unknown> {
	try {
		await pending;
	} catch (error) {
		return error;
	}
	return new Error('expected a rejection');
}

test('Disabled GitHub returns detached functions that reject', async () => {
	const { authorizeRepository, token } = composeHubAuth(fixtureParts());
	const actor = {} as Parameters<Hub['authorizeRepository']>[0];
	const tokenInput = {} as Parameters<Hub['token']>[0];
	const authorize = await rejectionOf(authorizeRepository(actor, 4242));
	const issued = await rejectionOf(token(tokenInput));
	expect(authorize).toEqual(new AuthFailure('github-disabled'));
	expect(issued).toEqual(new AuthFailure('github-disabled'));
	recordExampleCases(
		{
			unitId: UNIT_ID,
			symbol: 'composeHubAuth',
			state: 'disabled-github-returns-detached-functions-that-reject',
			evidence: 'examples-cases',
			file: 'disabled-github-returns-detached-functions-that-reject.json'
		},
		[
			{
				name: 'authorize a repository while config.github is absent',
				input: { repositoryId: 4242 },
				error: String(authorize)
			},
			{
				name: 'mint an installation token while config.github is absent',
				input: {},
				error: String(issued)
			}
		]
	);
});

test('Anonymous requests resolve no actor and pass through', async () => {
	const hub = composeHubAuth(fixtureParts());
	const request = () => new Request(`${ORIGIN}/api/projects`);
	const actor = await hub.actor(request());
	const handled = await hub.handle(request());
	expect(actor).toBeNull();
	expect(handled).toBeNull();
	recordExampleCases(
		{
			unitId: UNIT_ID,
			symbol: 'composeHubAuth',
			state: 'anonymous-requests-resolve-no-actor-and-pass-through',
			evidence: 'examples-cases',
			file: 'anonymous-requests-resolve-no-actor-and-pass-through.json'
		},
		[
			{
				name: 'request without a session cookie resolves no actor',
				input: { method: 'GET', path: '/api/projects' },
				output: actor
			},
			{
				name: 'path outside /api/auth and /api/github is not handled',
				input: { method: 'GET', path: '/api/projects' },
				output: handled
			}
		]
	);
});
