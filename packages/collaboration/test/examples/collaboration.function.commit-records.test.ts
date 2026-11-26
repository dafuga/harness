import { test } from 'vitest';
import { commitRecords } from '../../src/utils/git-source-history/create-git-hub-repository/commitRecords';
import type { CollaborationRecords } from '../../src/models/planning-collaboration/Collaboration.types';
import type { GitHubTransport } from '../../src/utils/git-source-history/githubTransport.types';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { expect } from '../../../../test/verificationExpect';
import type { RequestCall } from './collaboration.function.commit-records.test.types';

const path = 'packages/collaboration/collaboration-records.json';
const parent = '0123456789abcdef0123456789abcdef01234567';
const parentTree = '3'.repeat(40);
const blob = '1'.repeat(40);
const tree = '2'.repeat(40);
const created = '89abcdef0123456789abcdef0123456789abcdef';
const records: CollaborationRecords = {
	schemaVersion: 1,
	projects: [],
	members: [],
	invitations: [],
	threads: []
};

function recordingTransport(responses: Record<string, unknown>) {
	const calls: RequestCall[] = [];
	const client: GitHubTransport = {
		async request(endpoint, input) {
			const call: RequestCall = { path: endpoint, method: input?.method ?? 'GET' };
			if (input?.body !== undefined) call.body = input.body;
			calls.push(call);
			return { status: 200, data: responses[endpoint], hasNext: false };
		},
		async check() {}
	};
	return { client, calls };
}

function rejectingTransport(): GitHubTransport {
	return {
		async request() {
			throw new Error('GitHub request failed');
		},
		async check() {}
	};
}

function summarizedResult(sha: string, calls: RequestCall[]) {
	return {
		sha,
		requests: calls.map(({ path: endpoint, method, body }) => {
			if (endpoint === '/git/blobs') {
				const blobBody = body as { encoding: string; content: string };
				const serialized: unknown = JSON.parse(atob(blobBody.content));
				return {
					path: endpoint,
					method,
					body: { encoding: blobBody.encoding, records: serialized }
				};
			}
			return { path: endpoint, method, ...(body === undefined ? {} : { body }) };
		})
	};
}

function evidence(state: string) {
	return {
		unitId: 'collaboration.function.commit-records',
		symbol: 'commitRecords',
		state,
		evidence: 'examples-cases',
		file: `${state}.json`
	};
}

test('creates a root commit without reading a parent', async () => {
	const { client, calls } = recordingTransport({
		'/git/blobs': { sha: blob },
		'/git/trees': { sha: tree },
		'/git/commits': { sha: created }
	});
	const input = { parent: null, path, records };
	const sha = await commitRecords(client, input);

	recordExampleCases(evidence('creates-a-root-commit-without-reading-a-parent'), [
		{
			name: 'empty collaboration records start a commit without a parent',
			input,
			output: summarizedResult(sha, calls)
		}
	]);
	expect(sha).toBe(created);
	expect(calls).toEqual([
		{
			path: '/git/blobs',
			method: 'POST',
			body: { encoding: 'base64', content: btoa(JSON.stringify(records)) }
		},
		{
			path: '/git/trees',
			method: 'POST',
			body: { tree: [{ path, mode: '100644', type: 'blob', sha: blob }] }
		},
		{
			path: '/git/commits',
			method: 'POST',
			body: {
				message: 'Update private collaboration records',
				tree,
				parents: []
			}
		}
	]);
});

test('creates a child commit from its parent tree', async () => {
	const { client, calls } = recordingTransport({
		[`/git/commits/${parent}`]: { tree: { sha: parentTree } },
		'/git/blobs': { sha: blob },
		'/git/trees': { sha: tree },
		'/git/commits': { sha: created }
	});
	const input = { parent, path, records };
	const sha = await commitRecords(client, input);

	recordExampleCases(evidence('creates-a-child-commit-from-its-parent-tree'), [
		{
			name: 'empty collaboration records extend the specified parent commit',
			input,
			output: summarizedResult(sha, calls)
		}
	]);
	expect(sha).toBe(created);
	expect(calls).toEqual([
		{ path: `/git/commits/${parent}`, method: 'GET' },
		{
			path: '/git/blobs',
			method: 'POST',
			body: { encoding: 'base64', content: btoa(JSON.stringify(records)) }
		},
		{
			path: '/git/trees',
			method: 'POST',
			body: {
				base_tree: parentTree,
				tree: [{ path, mode: '100644', type: 'blob', sha: blob }]
			}
		},
		{
			path: '/git/commits',
			method: 'POST',
			body: {
				message: 'Update private collaboration records',
				tree,
				parents: [parent]
			}
		}
	]);
});

test('Throws Error when a GitHub request rejects', async () => {
	const input = { parent: null, path, records };
	const client = rejectingTransport();
	await expect(commitRecords(client, input)).rejects.toThrow('GitHub request failed');
	recordExampleCases(evidence('throws-error-when-a-github-request-rejects'), [
		{
			name: 'a rejected blob request rejects commit creation',
			input,
			error: 'Error: GitHub request failed'
		}
	]);
});
