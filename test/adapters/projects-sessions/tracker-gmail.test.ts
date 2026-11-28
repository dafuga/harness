import { expect, test, vi } from 'vitest';
import { TrackerGmailAdapter } from '../../../src/adapters/projects-sessions/TrackerGmailAdapter';
import type { TrackerMessageMatch } from '../../../src/repositories/projects-sessions/TrackerAdapterRepository.types';

const account = 'fixture@example.test';
const signal = new AbortController().signal;
const match: TrackerMessageMatch = {
	senders: [],
	domains: [],
	threads: ['thread-a'],
	keyword: 'budget review'
};
const query = { since: 12_000, backfill: false, signal };

test('reads a paginated phrase search and thread metadata with GET-only mailbox binding', async () => {
	const transport = vi.fn(gmailFixture);
	const readAccessToken = vi.fn(async () => 'fixture-access-token');
	const adapter = new TrackerGmailAdapter({ account, readAccessToken }, transport);
	expect(await Array.fromAsync(adapter.read(match, query))).toEqual([
		{
			id: 'a',
			threadId: 'thread-a',
			receivedAt: 13_000,
			sender: 'sender@example.test',
			keywordMatched: true
		},
		{
			id: 'b',
			threadId: 'thread-a',
			receivedAt: 13_000,
			sender: 'sender@example.test',
			keywordMatched: false
		}
	]);
	expect(readAccessToken).toHaveBeenCalledOnce();
	const requests = transport.mock.calls;
	expect(requests.map(([url]) => new URL(String(url)).pathname.split('/').at(-1))).toEqual([
		'profile',
		'messages',
		'a',
		'sent',
		'messages',
		'messages',
		'b'
	]);
	for (const [url, init] of requests) {
		expect(new URL(String(url)).origin).toBe('https://gmail.googleapis.com');
		expect(init).toMatchObject({ method: 'GET', redirect: 'error' });
	}
});

test('rejects a mismatched mailbox or provider error without exposing provider details', async () => {
	const config = { account, readAccessToken: async () => 'fixture-access-token' };
	const wrong = new TrackerGmailAdapter({ ...config, account: 'wrong@example.test' }, gmailFixture);
	await expect(Array.fromAsync(wrong.read(match, query))).rejects.toThrow(
		/^Gmail read unavailable$/
	);
	const failure = new TrackerGmailAdapter(config, () =>
		Promise.resolve(new Response('private synthetic error', { status: 401 }))
	);
	await expect(Array.fromAsync(failure.read(match, query))).rejects.toThrow(
		/^Gmail read unavailable$/
	);
});

async function gmailFixture(raw: string | URL | Request, _init?: RequestInit): Promise<Response> {
	const url = new URL(String(raw));
	if (url.pathname.endsWith('/profile')) return Response.json({ emailAddress: account });
	const id = url.pathname.split('/').at(-1);
	if (id === 'messages') return Response.json(listFixture(url.searchParams));
	expect(url.searchParams.get('format')).toBe('metadata');
	expect(url.searchParams.get('metadataHeaders')).toBe('From');
	expect(url.searchParams.get('fields')).toBe(
		'id,threadId,internalDate,labelIds,payload(headers(name,value))'
	);
	return Response.json({
		id,
		threadId: 'thread-a',
		internalDate: '13000',
		labelIds: id === 'sent' ? ['SENT'] : ['INBOX'],
		payload: { headers: [{ name: 'From', value: 'Fixture Sender <Sender@example.test>' }] }
	});
}

function listFixture(params: URLSearchParams) {
	const base = 'after:11 -in:sent -in:drafts';
	expect(params.get('fields')).toBe('messages(id,threadId),nextPageToken');
	const search = params.get('q');
	if (search === base)
		return { messages: [message('a'), message('b'), { id: 'skipped', threadId: 'different' }] };
	expect(search).toBe(`${base} "budget review"`);
	if (params.has('pageToken')) {
		expect(params.get('pageToken')).toBe('page-2');
		return {};
	}
	return { messages: [message('a'), message('sent')], nextPageToken: 'page-2' };
}

function message(id: string) {
	return { id, threadId: 'thread-a' };
}
