import { test } from 'vitest';
import type { GitHubOptions } from '../../src/models/planning-collaboration/Collaboration.types';
import { githubTransport } from '../../src/utils/git-source-history/githubTransport';
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
export const commit = '4e19d0b830e3f36f21f71e86850a1e79d62fd2bb';

export function clientWithResponses(permission: 'read' | 'write', responses: Response[]) {
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

export function response(data: unknown, status = 200) {
	return new Response(JSON.stringify(data), { status });
}

export function requestSummary(calls: RequestCall[]) {
	return calls.map(({ url, method, redirect, body }) => ({
		path: new URL(url).pathname,
		method,
		redirect,
		...(body === undefined ? {} : { body })
	}));
}

export function evidence(symbol: string, state: string) {
	return { unitId, symbol, state, evidence: 'examples-cases', file: `${state}.json` };
}

export async function captureError(operation: () => unknown | Promise<unknown>) {
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
