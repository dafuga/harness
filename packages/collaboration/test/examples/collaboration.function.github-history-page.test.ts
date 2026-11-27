import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { githubHistoryPage } from '../../src/utils/git-source-history/create-git-hub-source/githubHistoryPage';
import type {
	Repository,
	FakeResponse,
	Context
} from './collaboration.function.github-history-page.test.types';

const repository: Repository = {
	id: 418260917,
	owner: 'acme-labs',
	name: 'design-system',
	private: true,
	installationId: 52714309
};
const commit = '9f1c4e7a2b8d30c6e5f4a1b9d7c2e8f0a3b6d5c4';
const hashNewest = '9f1c4e7a2b8d30c6e5f4a1b9d7c2e8f0a3b6d5c4';
const hashMiddle = '5a0e8c3d7b1f6947e2c0a8d5b3f19e4c7d6a2b08';
const hashOldest = 'c8e2f5a0d94b71e63f0a2c9d5e8b1f7a4c6d3e90';
const pathA = 'packages/collaboration/src/utils/githubHistoryPage.ts';
const pathB = 'packages/collaboration/src/models/git-source-history/SourceHistory.types.ts';

function commitRecord(sha: string, message: string, author: string | null, committer: string) {
	const authorRecord = author === null ? null : { date: author };
	return { sha, commit: { message, author: authorRecord, committer: { date: committer } } };
}

/** A fake context whose transport answers each path from `responses` and logs every request URL. */
function fakeContext(responses: Record<string, FakeResponse>, calls: string[]): Context {
	const adapter = { resolve: async () => ({ sha: commit }) };
	const client = {
		request: async (url: string) => {
			calls.push(url);
			const path = new URLSearchParams(url.split('?')[1]).get('path') ?? '';
			const response = responses[path];
			if (!response) throw new Error('no fixture for path');
			return response;
		}
	};
	return { adapter, client } as unknown as Context;
}

async function errorCodeOf(run: Promise<unknown>): Promise<unknown> {
	try {
		await run;
		return 'no error';
	} catch (caught) {
		return (caught as { code?: unknown }).code;
	}
}

test('Merges duplicate commits across path requests', async () => {
	const calls: string[] = [];
	const context = fakeContext(
		{
			[pathA]: {
				hasNext: false,
				data: [
					commitRecord(
						hashNewest,
						'Merge duplicate commits\n\nDetails',
						'2026-11-10T09:14:02Z',
						'2026-11-10T09:20:00Z'
					),
					commitRecord(
						hashMiddle,
						'Validate history page size',
						'2026-11-07T16:48:51Z',
						'2026-11-07T16:50:00Z'
					)
				]
			},
			[pathB]: {
				hasNext: false,
				data: [
					commitRecord(
						hashMiddle,
						'Validate history page size',
						'2026-11-07T16:48:51Z',
						'2026-11-07T16:50:00Z'
					),
					commitRecord(hashOldest, 'Add evidence grid fixtures', null, '2026-10-29T11:02:37Z')
				]
			}
		},
		calls
	);
	const input = { commit, paths: [pathA, pathB, pathA] };
	const page = await githubHistoryPage(context, repository, input);
	const expected = {
		commits: [
			{ hash: hashNewest, subject: 'Merge duplicate commits', authoredAt: '2026-11-10T09:14:02Z' },
			{
				hash: hashMiddle,
				subject: 'Validate history page size',
				authoredAt: '2026-11-07T16:48:51Z'
			},
			{
				hash: hashOldest,
				subject: 'Add evidence grid fixtures',
				authoredAt: '2026-10-29T11:02:37Z'
			}
		],
		complete: true,
		nextPage: null
	};
	expect(page).toEqual(expected);
	expect(calls.length).toBe(2);
	recordExampleCases(
		{
			unitId: 'collaboration.function.github-history-page',
			symbol: 'githubHistoryPage',
			state: 'merges-duplicate-commits-across-path-requests',
			evidence: 'examples-cases',
			file: 'merges-duplicate-commits-across-path-requests.json'
		},
		[
			{
				name: 'two distinct paths with one shared commit and a duplicated path entry',
				input,
				output: { ...page, requestCount: calls.length }
			}
		]
	);
});

test('Reports the next page when a path response has more', async () => {
	const calls: string[] = [];
	const context = fakeContext(
		{
			[pathA]: {
				hasNext: true,
				data: [
					commitRecord(
						hashOldest,
						'Add evidence grid fixtures',
						'2026-10-29T11:02:37Z',
						'2026-10-29T11:02:37Z'
					)
				]
			}
		},
		calls
	);
	const input = { commit, paths: [pathA], page: 2, perPage: 50 };
	const page = await githubHistoryPage(context, repository, input);
	expect(page).toEqual({
		commits: [
			{
				hash: hashOldest,
				subject: 'Add evidence grid fixtures',
				authoredAt: '2026-10-29T11:02:37Z'
			}
		],
		complete: false,
		nextPage: 3
	});
	expect(calls).toEqual([
		`/commits?sha=${commit}&path=${encodeURIComponent(pathA)}&per_page=50&page=2`
	]);
	recordExampleCases(
		{
			unitId: 'collaboration.function.github-history-page',
			symbol: 'githubHistoryPage',
			state: 'reports-the-next-page-when-a-path-response-has-more',
			evidence: 'examples-cases',
			file: 'reports-the-next-page-when-a-path-response-has-more.json'
		},
		[
			{
				name: 'page 2 of one path whose response carries a next link',
				input,
				output: { ...page, requestUrls: calls }
			}
		]
	);
});

test('Rejects an unsafe path before any history request', async () => {
	const calls: string[] = [];
	const context = fakeContext({}, calls);
	const unsafePathCode = await errorCodeOf(
		githubHistoryPage(context, repository, { commit, paths: ['/etc/passwd'] })
	);
	const badCommitCode = await errorCodeOf(
		githubHistoryPage(context, repository, { commit: 'ABC123', paths: [pathA] })
	);
	expect(unsafePathCode).toBe('invalid-path');
	expect(badCommitCode).toBe('invalid-input');
	expect(calls).toEqual([]);
	recordExampleCases(
		{
			unitId: 'collaboration.function.github-history-page',
			symbol: 'githubHistoryPage',
			state: 'rejects-an-unsafe-path-before-any-history-request',
			evidence: 'examples-cases',
			file: 'rejects-an-unsafe-path-before-any-history-request.json'
		},
		[
			{
				name: 'absolute path is rejected by safePath',
				input: { commit, paths: ['/etc/passwd'] },
				error: unsafePathCode as string
			},
			{
				name: 'commit that is not 40 lowercase hex is rejected by the schema',
				input: { commit: 'ABC123', paths: [pathA] },
				error: badCommitCode as string
			}
		]
	);
});
