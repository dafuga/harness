import type { Fixture, View } from './remote-fixture-approval.test.types';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { accountPairing } from './remote-account-pairing';
import { startRemoteFixture } from '../scripts/remote-fixture-host';
let fixture: Fixture, publicDirectory: string;
const phone = { deviceName: 'Account stand-in' };
const control = async <T = View>(method: string, path: string, body?: object) => {
	const sent = body ? { body: JSON.stringify(body) } : {};
	return (await (await fetch(fixture.controlOrigin + path, { method, ...sent })).json()) as T;
};
/** A stand-in for a signed-in phone: its account request reached the fixture computer. */
async function asked() {
	const { pairing, pending } = await accountPairing(
		{
			origin: fixture.relayOrigin,
			hostId: fixture.hostId,
			hostKey: fixture.hostKey,
			submit: async (pairingId, request) => {
				const sent = await fetch(fixture.controlOrigin + '/account-request', {
					method: 'POST',
					body: JSON.stringify({ pairingId, request })
				});
				if (!sent.ok) throw new Error('The fixture refused the account request.');
			}
		},
		phone.deviceName
	);
	await expect.poll(async () => (await control('GET', '/status')).requests.length).toBe(1);
	return { pairing, pending };
}
beforeAll(async () => {
	publicDirectory = await mkdtemp(join(tmpdir(), 'harness-remote-fixture-asked-'));
	fixture = await startRemoteFixture({ publicDirectory, log: () => undefined, approval: 'asked' });
}, 60000);
afterAll(async () => {
	await fixture?.stop();
	await rm(publicDirectory, { recursive: true, force: true });
});

test('a phone that scanned waits: it is a request, not a device, and nothing is exchanged', async () => {
	const { pairing, pending } = await asked();
	const waiting = await control('GET', '/status');
	expect(waiting.requests).toMatchObject([
		{ deviceId: pending.deviceId, deviceName: 'Account stand-in' }
	]);
	expect(waiting.devices).toEqual([]);
	expect(await pairing.poll(pending)).toBe('requested');
	const denied = await control('POST', '/deny');
	expect([denied.requests, denied.devices]).toEqual([[], []]);
	expect(await pairing.poll(pending)).toBe('denied');
	await expect(pairing.exchange(pending)).rejects.toThrow();
}, 60000);

test('only the approval that is asked for makes the phone a device, with the grant it was given', async () => {
	const { pairing, pending } = await asked();
	expect(await pairing.poll(pending)).toBe('requested');
	const approved = await control('POST', '/approve', { agents: false });
	expect(approved.requests).toEqual([]);
	expect(approved.devices).toMatchObject([
		{ deviceId: pending.deviceId, name: 'Account stand-in', agents: false }
	]);
	const credentials = await pairing.exchange(pending);
	expect(credentials.grant).toEqual({ projects: [fixture.project], agents: false });
}, 60000);
