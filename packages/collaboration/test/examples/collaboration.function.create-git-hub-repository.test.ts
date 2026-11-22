import { test } from 'vitest';
import { createGitHubRepository } from '../../src/utils/git-source-history/create-git-hub-repository/createGitHubRepository';
import type {
	CollaborationRecords,
	GitHubRepositoryOptions
} from '../../src/models/planning-collaboration/Collaboration.types';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { expect } from '../../../../test/verificationExpect';

const state = 'reads-records-and-compare-and-swaps-a-private-branch';
const absent = '0'.repeat(40);
const created = 'd'.repeat(40);
const records: CollaborationRecords = {
	schemaVersion: 1,
	projects: [],
	members: [],
	invitations: [],
	threads: []
};

function jsonResponse(value: unknown) {
	return new Response(JSON.stringify(value), {
		headers: { 'content-type': 'application/json' }
	});
}

type FakeResponseInput = {
	method: string;
	endpoint: string;
	body: BodyInit | null | undefined;
	repositoryId: number;
	ref: string;
	branch: { sha: string | null };
};

function fakeGitHubResponse({
	method,
	endpoint,
	body,
	repositoryId,
	ref,
	branch
}: FakeResponseInput) {
	switch (`${method} ${endpoint}`) {
		case 'GET /':
			return jsonResponse({ id: repositoryId, private: true });
		case 'GET /git/ref/heads/collaboration':
			return branch.sha
				? jsonResponse({ ref, object: { sha: branch.sha } })
				: new Response(null, { status: 404 });
		case 'GET /contents/data/collaboration-records.json':
			return new Response(null, { status: 404 });
		case 'POST /git/blobs':
			return jsonResponse({ sha: 'a'.repeat(40) });
		case 'POST /git/trees':
			return jsonResponse({ sha: 'b'.repeat(40) });
		case 'POST /git/commits':
			return jsonResponse({ sha: created });
		case 'POST /git/refs': {
			const request = JSON.parse(String(body)) as { ref: string; sha: string };
			branch.sha = request.sha;
			return jsonResponse({ ref: request.ref, object: { sha: request.sha } });
		}
		default:
			return new Response('Unexpected fake GitHub request', { status: 500 });
	}
}

function githubFixture() {
	const ref = 'refs/heads/collaboration';
	const path = 'data/collaboration-records.json';
	const repository = {
		id: 42,
		owner: 'acme-tools',
		name: 'project-hub',
		private: true,
		installationId: 713
	};
	const prefix = `/repos/${repository.owner}/${repository.name}`;
	const calls: Array<{ method: string; path: string }> = [];
	const permissions: string[] = [];
	const branch = { sha: null as string | null };
	const options: GitHubRepositoryOptions = {
		repository,
		ref,
		path,
		token: async ({ permissions: requested }) => {
			permissions.push(requested.contents);
			return 'example-installation-token';
		},
		fetch: async (input, init) => {
			const url = new URL(String(input));
			const endpoint = url.pathname.slice(prefix.length) || '/';
			const method = init?.method ?? 'GET';
			calls.push({ method, path: `${endpoint}${url.search}` });
			return fakeGitHubResponse({
				method,
				endpoint,
				body: init?.body,
				repositoryId: repository.id,
				ref,
				branch
			});
		}
	};
	return { options, repository, ref, path, calls, permissions };
}

function caseEvidence() {
	return {
		unitId: 'collaboration.function.create-git-hub-repository',
		symbol: 'createGitHubRepository',
		state,
		evidence: 'examples-cases',
		file: `${state}.json`
	};
}

test('Reads records and compare-and-swaps a private branch', async () => {
	const fixture = githubFixture();
	const adapter = createGitHubRepository(fixture.options);
	const initial = await adapter.read();
	const written = await adapter.compareAndSwap(initial.revision, records);
	const stale = await adapter.compareAndSwap(initial.revision, records);
	const afterWrite = await adapter.read();
	const writes = fixture.calls.filter(({ method }) => method === 'POST');
	const invalidOptions = {
		...fixture.options,
		repository: { ...fixture.repository, private: false }
	};
	let invalidRepository: { code: string; message: string } | null = null;
	try {
		createGitHubRepository(invalidOptions);
	} catch (error) {
		if (error instanceof Error && 'code' in error)
			invalidRepository = { code: String(error.code), message: error.message };
		else throw error;
	}
	recordExampleCases(caseEvidence(), [
		{
			name: 'an absent branch is initialized, stale writes are refused, and absent files read empty',
			input: { repository: fixture.repository, ref: fixture.ref, path: fixture.path, records },
			output: {
				initial,
				written,
				stale,
				afterWrite,
				writes,
				permissions: fixture.permissions
			}
		},
		{
			name: 'public repositories are rejected for private collaboration storage',
			input: { repository: invalidOptions.repository, ref: fixture.ref, path: fixture.path },
			error: invalidRepository
		}
	]);
	expect(initial).toEqual({ revision: absent, records });
	expect(written).toBe(created);
	expect(stale).toBeNull();
	expect(afterWrite).toEqual({ revision: created, records });
	expect(writes.map(({ path }) => path)).toEqual([
		'/git/blobs',
		'/git/trees',
		'/git/commits',
		'/git/refs'
	]);
	expect(fixture.permissions.every((permission) => permission === 'write')).toBe(true);
	expect(invalidRepository).toEqual({
		code: 'private-storage-required',
		message: 'Collaboration private-storage-required'
	});
});

test('Throws Error when repository configuration is invalid', () => {
	const invalidConfigurations = [
		{
			name: 'a public repository cannot store collaboration records',
			input: {
				...githubFixture().options,
				repository: { ...githubFixture().repository, private: false }
			}
		},
		{
			name: 'a non-branch ref cannot store collaboration records',
			input: { ...githubFixture().options, ref: 'refs/tags/v1' }
		},
		{
			name: 'a traversal path cannot select collaboration records',
			input: { ...githubFixture().options, path: '../records.json' }
		}
	];
	const errors = invalidConfigurations.map(({ input }) => {
		try {
			createGitHubRepository(input);
			return { code: 'no-error', message: '' };
		} catch (error) {
			return error instanceof Error && 'code' in error
				? { code: String(error.code), message: error.message }
				: { code: 'untyped-error', message: String(error) };
		}
	});
	const stateId = 'throws-error-when-repository-configuration-is-invalid';
	expect(errors.map(({ code }) => code)).toEqual([
		'private-storage-required',
		'private-storage-required',
		'invalid-path'
	]);
	recordExampleCases(
		{
			unitId: 'collaboration.function.create-git-hub-repository',
			symbol: 'createGitHubRepository',
			state: stateId,
			evidence: 'examples-cases',
			file: `${stateId}.json`
		},
		invalidConfigurations.map(({ name, input }, index) => ({
			name,
			input: { repository: input.repository, ref: input.ref, path: input.path },
			error: errors[index]
		}))
	);
});
