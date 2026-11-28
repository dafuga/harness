import { expect, test, vi } from 'vitest';
import { TrackerGmailSendAdapter } from '../../../src/adapters/projects-sessions/TrackerGmailSendAdapter';
import type { TrackerOutgoingMessage } from '../../../src/repositories/projects-sessions/TrackerOutgoingDraftRepository.types';

const account = 'sender@example.test';
const attempt = '77ecc6dd-7d69-4c9c-9981-2804ecc6f93c';
const message: TrackerOutgoingMessage = {
	channel: 'gmail',
	account,
	to: ['receiver@example.test'],
	cc: ['copy@example.test'],
	subject: 'Re: [Harness test] Fixture',
	thread: { id: 'thread-1', label: 'Original thread' },
	body: 'This is a fixture test.'
};
const original = {
	messages: [
		{
			id: 'inbound-1',
			threadId: 'thread-1',
			payload: {
				headers: [
					{ name: 'Message-ID', value: '<original@example.test>' },
					{ name: 'References', value: '<previous@example.test>' },
					{ name: 'Subject', value: '[Harness test] Fixture' }
				]
			}
		}
	]
};

function fixture(selfTestThread?: string) {
	const fetcher = vi.fn<typeof fetch>();
	const adapter = new TrackerGmailSendAdapter({
		account,
		selfTestThread,
		readAccessToken: async () => 'synthetic-token',
		fetcher
	});
	return { fetcher, adapter };
}

test('submits the reviewed MIME body with the authorized account and Gmail reply headers', async () => {
	const { adapter, fetcher } = fixture();
	fetcher.mockResolvedValueOnce(Response.json(original));
	fetcher.mockResolvedValueOnce(Response.json({ id: 'sent-1', threadId: 'thread-1' }));
	await expect(adapter.send(message, attempt)).resolves.toEqual({
		kind: 'sent',
		receipt: {
			reference: 'sent-1',
			url: 'https://mail.google.com/mail/u/sender%40example.test/#all/thread-1'
		}
	});
	expect(fetcher).toHaveBeenCalledTimes(2);
	expect(String(fetcher.mock.calls[0][0])).toContain(
		'/users/sender%40example.test/threads/thread-1?'
	);
	const selection = new URL(String(fetcher.mock.calls[0][0])).searchParams;
	expect(selection.get('format')).toBe('metadata');
	expect(selection.get('fields')).toBe('messages(threadId,payload(headers(name,value)))');
	expect(selection.getAll('metadataHeaders')).toEqual(['Message-ID', 'Subject', 'References']);
	const [url, options] = fetcher.mock.calls[1];
	expect(url).toBe(
		'https://gmail.googleapis.com/gmail/v1/users/sender%40example.test/messages/send'
	);
	expect(options?.method).toBe('POST');
	expect(options?.redirect).toBe('error');
	const prepared = JSON.parse(String(options?.body));
	expect(prepared.threadId).toBe('thread-1');
	const mime = Buffer.from(prepared.raw, 'base64url').toString();
	expect(mime).toContain('To: receiver@example.test');
	expect(mime).toContain('Cc: copy@example.test');
	expect(mime).toContain('Subject: Re: [Harness test] Fixture');
	expect(mime).toContain('In-Reply-To: <original@example.test>');
	expect(mime).toContain('References: <previous@example.test>\r\n <original@example.test>');
	expect(mime).toContain('Message-ID: <' + attempt + '@example.test>');
	expect(mime).toContain(Buffer.from(message.body).toString('base64'));
});

test('refuses a mismatched account or subject before sending and treats a lost delivery as unconfirmed', async () => {
	const { adapter, fetcher } = fixture();
	await expect(
		adapter.send({ ...message, account: 'other@example.test' }, attempt)
	).resolves.toEqual({ kind: 'failed' });
	expect(fetcher).not.toHaveBeenCalled();
	fetcher.mockResolvedValueOnce(Response.json(original));
	await expect(adapter.send({ ...message, subject: 'Different' }, attempt)).resolves.toEqual({
		kind: 'failed'
	});
	expect(fetcher).toHaveBeenCalledTimes(1);
	fetcher.mockResolvedValueOnce(Response.json(original));
	fetcher.mockRejectedValueOnce(new Error('lost response'));
	await expect(adapter.send(message, attempt)).resolves.toEqual({ kind: 'unconfirmed' });
	expect(fetcher).toHaveBeenCalledTimes(3);
});

test('a live test binding refuses any other recipient, copy, thread or subject before reading Gmail', async () => {
	const { adapter, fetcher } = fixture('thread-1');
	const allowed = { ...message, to: [account], cc: [] };
	for (const changes of [
		{ to: ['other@example.test'] },
		{ to: [account, account] },
		{ cc: [account] },
		{ thread: { id: 'other-thread', label: 'Other thread' } },
		{ thread: undefined },
		{ subject: 'Unlabelled' }
	]) {
		await expect(adapter.send({ ...allowed, ...changes }, attempt)).resolves.toEqual({
			kind: 'failed'
		});
	}
	expect(fetcher).not.toHaveBeenCalled();
	fetcher.mockResolvedValueOnce(Response.json(original));
	fetcher.mockResolvedValueOnce(Response.json({ id: 'sent-1', threadId: 'thread-1' }));
	await expect(adapter.send(allowed, attempt)).resolves.toMatchObject({ kind: 'sent' });
	expect(fetcher).toHaveBeenCalledTimes(2);
});
