import { expect, test, vi } from 'vitest';
import { setup } from '../remote-device-fixture';

const snapshot = { overview: { status: 'unavailable' }, agents: [], plans: [] };

test('an approved device of the account reads this computer’s Home view, read on every ask', async () => {
	const home = vi.fn(async () => snapshot);
	const s = await setup(false, false, home);
	const phone = s.phone();
	const attachment = await phone.attach();
	expect(attachment.methods).toContain('homeSnapshot');
	expect(await phone.client.request('homeSnapshot')).toEqual(snapshot);
	expect(await phone.client.request('homeSnapshot')).toEqual(snapshot);
	expect(home).toHaveBeenCalledTimes(2);
}, 30000);

test('a computer that shares no Home view offers no such method and answers nothing', async () => {
	const s = await setup();
	const phone = s.phone();
	expect((await phone.attach()).methods).not.toContain('homeSnapshot');
	await expect(phone.client.request('homeSnapshot')).rejects.toMatchObject({
		code: 'method-denied'
	});
}, 30000);

test('a revoked device is not answered with the Home view', async () => {
	const home = vi.fn(async () => snapshot);
	const s = await setup(false, false, home);
	const phone = s.phone();
	await phone.attach();
	s.records.delete(s.deviceId);
	s.sessions.revoke(s.deviceId);
	await phone.client.request('homeSnapshot').catch(() => undefined);
	expect(home).not.toHaveBeenCalled();
}, 30000);

test('an account device answers an open ask through this computer, once per request', async () => {
	const home = vi.fn(async () => snapshot);
	const homeChat = vi.fn(async (input: unknown) => ({
		id: (input as { id: string }).id,
		status: 'sent' as const
	}));
	const s = await setup(false, false, home, homeChat);
	const phone = s.phone();
	expect((await phone.attach()).methods).toContain('homeChat');
	const message = { id: '1', itemId: 'item', kind: 'answer', option: 1 };
	expect(await phone.client.request('homeChat', message)).toEqual({ id: '1', status: 'sent' });
	expect(homeChat).toHaveBeenCalledExactlyOnceWith(message);
}, 30000);

test('a computer without the Home writer offers no homeChat', async () => {
	const s = await setup(false, false, async () => snapshot);
	const phone = s.phone();
	expect((await phone.attach()).methods).not.toContain('homeChat');
	await expect(phone.client.request('homeChat', {})).rejects.toMatchObject({
		code: 'method-denied'
	});
}, 30000);
