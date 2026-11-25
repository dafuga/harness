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
