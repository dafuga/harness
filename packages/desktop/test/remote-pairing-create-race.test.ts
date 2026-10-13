import { expect, test } from 'vitest';
import { HostPairingService, remoteIdentity, remoteKeys } from '../../remote/src/index';
import type { RemoteHostStatus } from '../../remote/src/index';
import type { ProjectRegistryService } from '../src/services/ProjectRegistryService';
import { RemotePairingControlService } from '../src/services/RemotePairingControlService';
import type { RemoteHostAccess } from '../src/services/RemotePairingControlService';

/**
 * Two offers under way at once, on the real pairing control and the real host pairing. The
 * relay is a link whose answers a test holds back and then gives or refuses. What one opening
 * cleans up is its own offer only: it never closes, returns or withdraws a newer one.
 */
type Command = { type: string; pairingId: string };
interface Held {
	command: Command;
	answer: () => void;
	refuse: (error: Error) => void;
}

async function control() {
	const keys = await remoteKeys(),
		hostId = await remoteIdentity(keys.publicKey),
		pairing = new HostPairingService({ keys, hostId });
	const sent: Command[] = [],
		held: Held[] = [],
		holding = new Set<number>();
	let opened = 0;
	/** Every command is recorded; the openings a test named wait until it lets them end. */
	const command = (value: Command) => {
		sent.push(value);
		if (value.type !== 'pairing-open' || !holding.has(++opened)) return Promise.resolve();
		return new Promise<void>((answer, refuse) => held.push({ command: value, answer, refuse }));
	};
	const state = { origin: 'https://relay.example', hostId, devices: [], revoked: [] };
	const offer = () => pairing.offer();
	const access = {
		current: () => ({ state, runtime: { pairing, link: { command }, sessions: {} } }),
		published: async () => ({ pairing: offer(), requests: pairing.requests() }),
		saved: async () => ({}),
		name: () => 'Synthetic host'
	};
	const service = new RemotePairingControlService(
		access as unknown as RemoteHostAccess,
		{ list: async () => [] } as unknown as ProjectRegistryService
	);
	const closed = () =>
		sent.filter((item) => item.type === 'pairing-close').map((item) => item.pairingId);
	return { service, pairing, sent, held, hold: (nth: number) => holding.add(nth), offer, closed };
}
/** How a pending call ended, without letting a rejection escape the test. */
const ended = (call: Promise<unknown>) =>
	call.then(
		(value) => ({ value: value as { pairingId: string } | RemoteHostStatus, error: '' }),
		(error: Error) => ({ value: null, error: error.message })
	);

test('an older opening that fails later does not close the newer offer', async () => {
	const f = await control();
	f.hold(1);
	const older = ended(f.service.createPairing());
	const newer = await f.service.createPairing();
	expect(f.offer()?.pairingId).toBe(newer.pairingId);
	const first = f.held[0].command.pairingId;
	expect(first).not.toBe(newer.pairingId);
	f.held[0].refuse(new Error('The relay refused the older offer.'));
	expect(await older).toEqual({ value: null, error: 'The relay refused the older offer.' });
	expect(f.offer()?.pairingId).toBe(newer.pairingId);
	expect(f.closed()).toEqual([first]);
});

test('an older opening that succeeds late is not answered with the newer offer', async () => {
	const f = await control();
	f.hold(1);
	const older = ended(f.service.createPairing());
	const newer = await f.service.createPairing();
	f.held[0].answer();
	const late = await older;
	expect(late.value).toBeNull();
	expect(late.error).toBe('A newer pairing code replaced this one.');
	expect(f.offer()?.pairingId).toBe(newer.pairingId);
	expect(f.closed()).toEqual([f.held[0].command.pairingId]);
});

test('the opening that fails still closes its own offer, and nothing else', async () => {
	const f = await control();
	f.hold(1);
	const only = ended(f.service.createPairing());
	f.held[0].refuse(new Error('The relay is not connected.'));
	expect(await only).toEqual({ value: null, error: 'The relay is not connected.' });
	expect(f.offer()).toBeNull();
	expect(f.closed()).toEqual([]);
});

test('an offer withdrawn while it is opening stays withdrawn, whatever its opening answers', async () => {
	for (const outcome of ['answer', 'refuse'] as const) {
		const f = await control();
		f.hold(1);
		const opening = ended(f.service.createPairing());
		const pairingId = f.held[0].command.pairingId;
		await f.service.closePairing();
		expect(f.offer()).toBeNull();
		if (outcome === 'answer') f.held[0].answer();
		else f.held[0].refuse(new Error('The relay did not answer.'));
		expect((await opening).value).toBeNull();
		expect(f.offer()).toBeNull();
		expect(f.closed()).toEqual([pairingId]);
	}
});

test('a withdrawal between two openings leaves the newer offer alone when the older one fails', async () => {
	const f = await control();
	f.hold(1);
	const older = ended(f.service.createPairing());
	await f.service.closePairing();
	const newer = await f.service.createPairing();
	f.held[0].refuse(new Error('The relay refused the older offer.'));
	await older;
	expect(f.offer()?.pairingId).toBe(newer.pairingId);
	expect(f.closed()).not.toContain(newer.pairingId);
});
