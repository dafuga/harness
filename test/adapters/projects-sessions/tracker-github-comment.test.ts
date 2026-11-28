import { expect, test, vi } from 'vitest';
import { TrackerGithubCommentAdapter } from '../../../src/adapters/projects-sessions/TrackerGithubCommentAdapter';
import type { TrackerOutgoingMessage } from '../../../src/repositories/projects-sessions/TrackerOutgoingDraftRepository.types';

const message: TrackerOutgoingMessage = {
	channel: 'github-comment',
	account: 'octocat',
	to: ['example/harness#19'],
	cc: [],
	thread: { id: '19', label: 'Issue 19' },
	body: 'Reviewed comment.\n\n[ai-generated]'
};
const url = 'https://github.com/example/harness/issues/19#issuecomment-31';

function fixture() {
	const fetcher = vi.fn<typeof fetch>();
	const adapter = new TrackerGithubCommentAdapter({
		account: 'octocat',
		userId: 42,
		repositories: ['example/harness'],
		readAccessToken: async () => 'synthetic_token',
		fetcher
	});
	return { adapter, fetcher };
}

test('posts to the reviewed issue under the verified GitHub account and returns its receipt', async () => {
	const { adapter, fetcher } = fixture();
	fetcher
		.mockResolvedValueOnce(Response.json({ id: 42, login: 'octocat' }))
		.mockResolvedValueOnce(
			Response.json({ id: 31, html_url: url, user: { id: 42 } }, { status: 201 })
		);
	expect(adapter.matches(message)).toBe(true);
	await expect(adapter.send(message)).resolves.toEqual({
		kind: 'sent',
		receipt: { reference: '31', url }
	});
	expect(fetcher.mock.calls.map(([target, options]) => [String(target), options?.method])).toEqual([
		['https://api.github.com/user', 'GET'],
		['https://api.github.com/repos/example/harness/issues/19/comments', 'POST']
	]);
	expect(JSON.parse(String(fetcher.mock.calls[1][1]?.body))).toEqual({ body: message.body });
});

test('refuses another destination or GitHub identity before any comment, and holds an ambiguous loss', async () => {
	const { adapter, fetcher } = fixture();
	await expect(adapter.send({ ...message, to: ['foreign/project#19'] })).resolves.toEqual({
		kind: 'failed'
	});
	expect(fetcher).not.toHaveBeenCalled();
	fetcher.mockResolvedValueOnce(Response.json({ id: 24, login: 'someone-else' }));
	await expect(adapter.send(message)).resolves.toEqual({ kind: 'failed' });
	expect(fetcher).toHaveBeenCalledTimes(1);
	fetcher
		.mockResolvedValueOnce(Response.json({ id: 42, login: 'octocat' }))
		.mockRejectedValueOnce(new Error('timeout'));
	await expect(adapter.send(message)).resolves.toEqual({ kind: 'unconfirmed' });
});
