import { test } from 'vitest';
import type { GitHubOptions } from '../../src/models/planning-collaboration/Collaboration.types';
import { exactRef } from '../../src/utils/git-source-history/create-git-hub-source/exactRef';
import {
	base64,
	decode64,
	githubTransport,
	readRef,
	refPath
} from '../../src/utils/git-source-history/githubTransport';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { expect } from '../../../../test/verificationExpect';
import type { RequestCall } from './collaboration.function.github-transport.test.types';

const unitId = 'collaboration.function.github-transport';
const repository = {
	id: 41,
	owner: 'northstar-labs',
	name: 'project-data',
	private: true,
	installationId: 73
};
const commit = '4e19d0b830e3f36f21f71e86850a1e79d62fd2bb';

function clientWithResponses(permission: 'read' | 'write', responses: Response[]) {
	const calls: RequestCall[] = [];
	const tokenRequests: Array<Parameters<GitHubOptions['token']>[0]> = [];
	const options: GitHubOptions = {
		repository,
		token: async (input) => {
			tokenRequests.push(input);
			return 'example-token';
		},
		fetch: async (input, init) => {
			calls.push({
				url: String(input),
				method: init?.method ?? 'GET',
				redirect: init?.redirect ?? 'follow',
				...(typeof init?.body === 'string' ? { body: init.body } : {})
			});
			const response = responses.shift();
			if (!response) throw new Error('No example response configured');
			return response;
		}
	};
	return { client: githubTransport(options, permission), calls, tokenRequests };
}

function response(data: unknown, status = 200) {
	return new Response(JSON.stringify(data), { status });
}

function requestSummary(calls: RequestCall[]) {
	return calls.map(({ url, method, redirect, body }) => ({
		path: new URL(url).pathname,
		method,
		redirect,
		...(body === undefined ? {} : { body })
	}));
}

function evidence(symbol: string, state: string) {
	return { unitId, symbol, state, evidence: 'examples-cases', file: `${state}.json` };
}

async function captureError(operation: () => unknown | Promise<unknown>) {
	try {
		await operation();
		return null;
	} catch (error) {
		if (error instanceof Error && 'code' in error && typeof error.code === 'string')
			return { message: error.message, code: error.code };
		return { message: String(error) };
	}
}

test('Creates a scoped GitHub contents transport', async () => {
	const reader = clientWithResponses('read', [
		response({ sha: commit, name: 'records.json' }),
		response({ id: repository.id, private: true })
	]);
	const contents = await reader.client.request('/contents/records.json');
	const checked = await reader.client.check(true);
	const invalidPath = await captureError(() => reader.client.request('contents/records.json'));
	const writer = clientWithResponses('write', [response({ content: { sha: commit } })]);
	const update = { message: 'Update collaboration records' };
	const written = await writer.client.request('/contents/records.json', {
		method: 'PUT',
		body: update
	});
	expect(contents).toMatchObject({ status: 200, data: { sha: commit }, hasNext: false });
	expect(checked).toBeUndefined();
	expect(invalidPath).toEqual({ message: 'Collaboration invalid-path', code: 'invalid-path' });
	expect(written).toMatchObject({ status: 200, data: { content: { sha: commit } } });
	expect(
		reader.tokenRequests.map(({ repositoryIds, permissions }) => ({ repositoryIds, permissions }))
	).toEqual([
		{ repositoryIds: [repository.id], permissions: { contents: 'read' } },
		{ repositoryIds: [repository.id], permissions: { contents: 'read' } }
	]);
	expect(writer.tokenRequests[0]?.permissions).toEqual({ contents: 'write' });
	expect(requestSummary(reader.calls)).toEqual([
		{
			path: '/repos/northstar-labs/project-data/contents/records.json',
			method: 'GET',
			redirect: 'manual'
		},
		{ path: '/repos/northstar-labs/project-data', method: 'GET', redirect: 'manual' }
	]);
	expect(requestSummary(writer.calls)[0]).toMatchObject({
		path: '/repos/northstar-labs/project-data/contents/records.json',
		method: 'PUT',
		redirect: 'manual',
		body: JSON.stringify({ message: 'Update collaboration records' })
	});
	recordExampleCases(evidence('githubTransport', 'creates-a-scoped-github-contents-transport'), [
		{
			name: 'read and check the configured private repository',
			input: {
				repository: 'northstar-labs/project-data',
				permission: 'read',
				path: '/contents/records.json',
				privateOnly: true
			},
			output: {
				request: contents,
				privateCheck: 'passed',
				calls: requestSummary(reader.calls.slice(0, 2))
			}
		},
		{
			name: 'request a write token for a contents update',
			input: {
				repository: 'northstar-labs/project-data',
				permission: 'write',
				path: '/contents/records.json',
				method: 'PUT',
				body: update
			},
			output: {
				status: written.status,
				contentSha: (written.data as { content: { sha: string } }).content.sha
			}
		},
		{
			name: 'reject a relative request path',
			input: { path: 'contents/records.json' },
			error: invalidPath
		}
	]);
});

test('Maps supported Git refs to API paths', () => {
	const cases = [
		{ ref: 'refs/heads/main', path: 'heads/main' },
		{ ref: 'refs/notes/releases', path: 'notes/releases' },
		{ ref: 'refs/tags/v2.4.0', path: 'tags/v2.4.0' },
		{ ref: 'refs/heads/feature/release#1', path: 'heads/feature/release%231' }
	];
	const results = cases.map(({ ref }) => refPath(ref));
	expect(results).toEqual(cases.map(({ path }) => path));
	recordExampleCases(
		evidence('refPath', 'maps-supported-git-refs-to-api-paths'),
		cases.map(({ ref, path }) => ({ name: `map ${ref}`, input: { ref }, output: { path } }))
	);
});

test('Reads exact branch and notes refs', async () => {
	const other = '1111111111111111111111111111111111111111';
	const notesSha = '2222222222222222222222222222222222222222';
	const reads = clientWithResponses('read', [
		response({ ref: 'refs/heads/main', object: { sha: commit } }),
		response([
			{ ref: 'refs/notes/releases/old', object: { sha: other } },
			{ ref: 'refs/notes/releases', object: { sha: notesSha } }
		]),
		response([])
	]);
	const branchSha = await readRef(reads.client, 'refs/heads/main');
	const notesResult = await readRef(reads.client, 'refs/notes/releases');
	const emptyNotes = await readRef(reads.client, 'refs/notes/missing');
	expect(branchSha).toBe(commit);
	expect(notesResult).toBe(notesSha);
	expect(emptyNotes).toBeNull();
	expect(requestSummary(reads.calls).map(({ path }) => path)).toEqual([
		'/repos/northstar-labs/project-data/git/ref/heads/main',
		'/repos/northstar-labs/project-data/git/matching-refs/notes/releases',
		'/repos/northstar-labs/project-data/git/matching-refs/notes/missing'
	]);
	recordExampleCases(evidence('readRef', 'reads-exact-branch-and-notes-refs'), [
		{
			name: 'read the exact main branch ref',
			input: { repository: 'northstar-labs/project-data', ref: 'refs/heads/main' },
			output: { sha: branchSha, requestPath: requestSummary(reads.calls)[0]?.path }
		},
		{
			name: 'match the exact notes ref among a prefix result',
			input: {
				ref: 'refs/notes/releases',
				matchingRefs: ['refs/notes/releases/old', 'refs/notes/releases']
			},
			output: { sha: notesResult, requestPath: requestSummary(reads.calls)[1]?.path }
		},
		{
			name: 'treat an empty notes match as absent',
			input: { ref: 'refs/notes/missing', matchingRefs: [] },
			output: { sha: emptyNotes }
		}
	]);
});

test('Resolves exact refs and rejects missing refs', async () => {
	const resolved = clientWithResponses('read', [
		response({ ref: 'refs/tags/v2.4.0', object: { sha: commit } }),
		new Response(null, { status: 404 })
	]);
	const ref = 'refs/tags/v2.4.0';
	const result = await exactRef(resolved.client, ref);
	const missingError = await captureError(() => exactRef(resolved.client, 'refs/heads/archive'));
	expect(result).toBe(commit);
	expect(missingError).toEqual({ message: 'Collaboration not-found', code: 'not-found' });
	recordExampleCases(evidence('exactRef', 'resolves-exact-refs-and-rejects-missing-refs'), [
		{
			name: 'resolve the exact release tag',
			input: { ref },
			output: { sha: result }
		},
		{
			name: 'reject a missing branch ref',
			input: { ref: 'refs/heads/archive', responseStatus: 404 },
			error: missingError
		}
	]);
});

test('Encodes byte arrays as standard base64', () => {
	const inputs = [
		[72, 101, 108, 108, 111],
		[0, 1, 2]
	];
	const results = inputs.map((bytes) => base64(Uint8Array.from(bytes)));
	expect(results).toEqual(['SGVsbG8=', 'AAEC']);
	recordExampleCases(evidence('base64', 'encodes-byte-arrays-as-standard-base64'), [
		{ name: 'encode Hello bytes', input: { bytes: inputs[0] }, output: { value: results[0] } },
		{
			name: 'encode leading zero bytes',
			input: { bytes: inputs[1] },
			output: { value: results[1] }
		}
	]);
});

test('Decodes whitespace and rejects invalid base64', async () => {
	const value = ' SGVs\nbG8= ';
	const bytes = decode64(value);
	const invalidError = await captureError(() => decode64('***'));
	expect([...bytes]).toEqual([72, 101, 108, 108, 111]);
	expect(invalidError).toEqual({
		message: 'Collaboration invalid-content',
		code: 'invalid-content'
	});
	recordExampleCases(evidence('decode64', 'decodes-whitespace-and-rejects-invalid-base64'), [
		{
			name: 'ignore whitespace around encoded text',
			input: { value },
			output: { bytes: [...bytes] }
		},
		{ name: 'reject invalid encoded content', input: { value: '***' }, error: invalidError }
	]);
});
