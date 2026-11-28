import { expect, test, vi } from 'vitest';
import { TrackerSmsSendAdapter } from '../../../src/adapters/projects-sessions/TrackerSmsSendAdapter';
import type { TrackerOutgoingMessage } from '../../../src/repositories/projects-sessions/TrackerOutgoingDraftRepository.types';

const accountSid = 'AC' + '1'.repeat(32);
const keySid = 'SK' + '2'.repeat(32);
const from = '+12025550101';
const to = '+12025550102';
const sid = 'SM' + '3'.repeat(32);
const message: TrackerOutgoingMessage = {
	channel: 'sms',
	account: from,
	to: [to],
	cc: [],
	body: 'Reviewed SMS'
};

function fixture() {
	const fetcher = vi.fn<typeof fetch>();
	const adapter = new TrackerSmsSendAdapter({
		accountSid,
		keySid,
		from,
		destinations: [to],
		readKeySecret: async () => 'synthetic-secret',
		fetcher
	});
	return { adapter, fetcher };
}

test('submits the exact approved text to the bound SMS number and stores the provider acceptance', async () => {
	const { adapter, fetcher } = fixture();
	fetcher.mockResolvedValue(
		Response.json({ account_sid: accountSid, from, to, sid, status: 'queued' }, { status: 201 })
	);
	expect(adapter.matches(message)).toBe(true);
	await expect(adapter.send(message)).resolves.toEqual({
		kind: 'sent',
		receipt: { reference: sid }
	});
	const [url, options] = fetcher.mock.calls[0];
	expect(String(url)).toBe(
		`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`
	);
	expect(options?.redirect).toBe('error');
	expect(Object.fromEntries(new URLSearchParams(String(options?.body)))).toEqual({
		From: from,
		To: to,
		Body: message.body
	});
});

test('refuses a foreign recipient without dispatch and holds a mismatched SMS receipt', async () => {
	const { adapter, fetcher } = fixture();
	await expect(adapter.send({ ...message, to: ['+12025550103'] })).resolves.toEqual({
		kind: 'failed'
	});
	expect(fetcher).not.toHaveBeenCalled();
	fetcher.mockResolvedValueOnce(
		Response.json(
			{ account_sid: accountSid, from, to: '+12025550103', sid, status: 'queued' },
			{ status: 201 }
		)
	);
	await expect(adapter.send(message)).resolves.toEqual({ kind: 'unconfirmed' });
});
