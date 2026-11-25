import { expect, test, vi } from 'vitest';
import { setup } from '../remote-device-fixture';

const balance = '424242.12345';
const snapshot = {
	overview: { status: 'unavailable' },
	agents: [],
	plans: [],
	providers: {
		routines: null,
		quota: [
			{
				id: 'codex',
				provider: 'codex',
				plan: 'Pro',
				account: null,
				readAt: '2026-11-25T18:00:00.000Z',
				limits: [{ id: 'weekly', label: 'Weekly', left: 29, resetsAt: '2026-11-26T00:00:00.000Z' }],
				credits: balance,
				history: [],
				agents: []
			}
		]
	}
};

test('an approved device of the account reads this computer’s Home view, read on every ask', async () => {
	const home = vi.fn(async () => snapshot);
	const s = await setup(false, false, home);
	const phone = s.phone();
	const attachment = await phone.attach();
	expect(attachment.methods).toContain('homeSnapshot');
	expect(await phone.client.request('homeSnapshot')).toEqual(snapshot);
	expect(await phone.client.request('homeSnapshot')).toEqual(snapshot);
	expect(home).toHaveBeenCalledTimes(2);
	expect(s.sent.filter(({ packet }) => packet.type === 'sealed').length).toBeGreaterThan(0);
	expect(JSON.stringify(s.sent)).not.toContain(balance);
	expect(JSON.stringify(s.sent)).not.toContain('2026-11-26T00:00:00.000Z');
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
