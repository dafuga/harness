import type { Actor, RepositoryIdentity } from 'collaboration';
import { test } from 'vitest';
import { GithubOwnerService } from '../../src/lib/verification-evidence/server/auth/GithubOwnerService';
import type { GithubOwnerOptions } from '../../src/lib/verification-evidence/server/auth/GithubOwnerService.types';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import type {
	AuthorizationExample,
	InstallationPage,
	OwnerFixture
} from './hub.service.github-owner.test.types';

const actor: Actor = {
	id: 'google-109876543210123456789',
	email: 'alex@example.com',
	name: 'Alex Rivera',
	emailVerified: true
};
const token = 'ghu_example_user_token';
const identity: RepositoryIdentity = {
	id: 123456789,
	owner: 'octo-org',
	name: 'sample-app',
	private: true,
	installationId: 7654322
};
const readOnly: RepositoryIdentity = {
	...identity,
	id: 987654321,
	name: 'public-tool',
	private: false,
	installationId: 7654321
};
const installations = { ids: [7654321, 7654322], total: 2 };
const authorizationExamples: AuthorizationExample[] = [
	{
		name: 'second reachable installation proves the repository',
		repositoryId: identity.id,
		fixture: { installations, identity, admin: true },
		expected: { output: identity }
	}
];
const repositoryPages = new Map<number, InstallationPage>([
	[
		7654321,
		{
			total: 2,
			repositories: [
				{ id: 123456789, owner: 'octo-org', name: 'sample-app', private: true, admin: true },
				{ id: 222222222, owner: 'octo-org', name: 'read-only-lib', private: false, admin: false }
			]
		}
	],
	[
		7654322,
		{
			total: 1,
			repositories: [
				{ id: 987654321, owner: 'octo-user', name: 'public-tool', private: false, admin: true }
			]
		}
	]
]);
const expectedRepositories = {
	repositories: [
		{ id: 123456789, owner: 'octo-org', name: 'sample-app', private: true },
		{ id: 987654321, owner: 'octo-user', name: 'public-tool', private: false }
	],
	truncated: false
};

function ownerFixture(input: OwnerFixture) {
	const calls = {
		actors: [] as Actor[],
		installations: [] as Array<{ token: string; appId: number }>,
		pages: [] as Array<{ installationId: number; page: number }>
	};
	const options = {
		grants: {
			userToken: async (received: Actor) => {
				calls.actors.push(received);
				return token;
			}
		},
		tokens: {
			resolve: async (installationId: number, repositoryId: number) =>
				input.identity?.installationId === installationId && input.identity.id === repositoryId
					? input.identity
					: null
		},
		api: {
			installations: async (accessToken: string, appId: number) => {
				calls.installations.push({ token: accessToken, appId });
				return input.installations;
			},
			repository: async (_token: string, target: { owner: string; name: string }) =>
				input.identity?.owner === target.owner && input.identity.name === target.name
					? { ...input.identity, admin: input.admin ?? false }
					: null,
			installationRepositories: async (_token: string, installationId: number, page: number) => {
				calls.pages.push({ installationId, page });
				return input.pages?.get(installationId) ?? null;
			}
		},
		appId: 123456
	} as unknown as GithubOwnerOptions;
	return { service: new GithubOwnerService(options), calls };
}

async function capture<T>(run: () => Promise<T>) {
	try {
		return { output: await run() } as const;
	} catch (error) {
		return { error: error instanceof Error ? error.message : String(error) } as const;
	}
}

test('authorizes an administered repository', async () => {
	const observed: Array<
		| { name: string; input: unknown; output: unknown }
		| { name: string; input: unknown; error: unknown }
	> = [];

	for (const example of authorizationExamples) {
		const fixture = ownerFixture(example.fixture);
		const input = { actor, repositoryId: example.repositoryId };
		const result = await capture(() =>
			fixture.service.authorizeRepository(actor, example.repositoryId)
		);
		expect(result).toEqual(example.expected);
		if ('output' in result) observed.push({ name: example.name, input, output: result.output });
		else observed.push({ name: example.name, input, error: result.error });
		expect(fixture.calls.actors).toEqual(example.repositoryId > 0 ? [actor] : []);
		expect(fixture.calls.installations).toEqual(
			example.repositoryId > 0 ? [{ token, appId: 123456 }] : []
		);
	}

	recordExampleCases(
		{
			unitId: 'hub.service.github-owner',
			symbol: 'authorizeRepository',
			state: 'authorizes-an-administered-repository',
			evidence: 'examples-cases',
			file: 'authorizes-an-administered-repository.json'
		},
		observed
	);
});

test('lists repositories administered by the actor', async () => {
	const fixture = ownerFixture({
		installations,
		pages: repositoryPages
	});
	const output = await fixture.service.repositories(actor);
	expect(output).toEqual(expectedRepositories);
	expect(fixture.calls.actors).toEqual([actor]);
	expect(fixture.calls.installations).toEqual([{ token, appId: 123456 }]);
	expect(fixture.calls.pages).toEqual([
		{ installationId: 7654321, page: 1 },
		{ installationId: 7654322, page: 1 }
	]);
	recordExampleCases(
		{
			unitId: 'hub.service.github-owner',
			symbol: 'repositories',
			state: 'lists-repositories-administered-by-the-actor',
			evidence: 'examples-cases',
			file: 'lists-repositories-administered-by-the-actor.json'
		},
		[
			{
				name: 'collect administered repositories across reachable installations',
				input: actor,
				output
			}
		]
	);
});

test('throws AuthFailure when authorization is denied', async () => {
	const cases = [
		{ name: 'invalid repository id', repositoryId: 0, fixture: { installations } },
		{
			name: 'no installation resolves the id',
			repositoryId: identity.id,
			fixture: { installations }
		},
		{
			name: 'actor lacks admin access',
			repositoryId: readOnly.id,
			fixture: { installations, identity: readOnly }
		}
	];
	const observed = await Promise.all(
		cases.map(async (example) => {
			const result = await capture(() =>
				ownerFixture(example.fixture).service.authorizeRepository(actor, example.repositoryId)
			);
			expect(result).toEqual({ error: 'Hub auth repository-denied' });
			return {
				name: example.name,
				input: { actor, repositoryId: example.repositoryId },
				error: 'Hub auth repository-denied'
			};
		})
	);
	recordExampleCases(
		{
			unitId: 'hub.service.github-owner',
			symbol: 'authorizeRepository',
			state: 'throws-authfailure-when-authorization-is-denied',
			evidence: 'examples-cases',
			file: 'throws-authfailure-when-authorization-is-denied.json'
		},
		observed
	);
});
