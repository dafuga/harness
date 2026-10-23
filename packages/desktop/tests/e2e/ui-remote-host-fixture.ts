import type {
	HostOptions,
	RemoteHost,
	Listener,
	Change,
	Grant
} from './ui-remote-host-fixture.types';
import type { Page } from '@playwright/test';
import { alpha, beta, projectFixture } from './ui-project-fixture';
export * from './ui-project-fixture';

/**
 * SYNTHETIC ADAPTER FIXTURE. Every value here is made up: there is no relay, no phone, no key
 * and no credential behind it. It stands where the Electron preload exposes
 * `window.harnessRemote`, and reports public metadata only, as that control port does.
 */
export const relayOrigin = 'https://relay.example.invalid';
export const pairing = {
	hostId: 'a1'.repeat(20),
	pairingId: 'b2'.repeat(16),
	code: 'KQ7M2XWP'
};
/** The pairing a second and a third offer are given: each new code is another pairing. */
export const laterPairings = ['c3'.repeat(16), 'd4'.repeat(16)];
export const phone = {
	deviceId: '4f2a91c07b3e' + 'd'.repeat(28),
	name: 'Ada iPhone',
	fingerprint: '4f2a 91c0 7b3e'
};

/** SYNTHETIC desktop state: what the port is told is recorded, what it says is fixture data. */
function installHostState(options: HostOptions) {
	const host = window as unknown as RemoteHost;
	const listeners = new Set<Listener>();
	const status = {
		supported: true,
		enabled: options.enabled,
		state: options.enabled ? 'online' : 'disabled',
		reason: null,
		host: { id: options.pairing.hostId, name: 'Synthetic Mac' },
		origin: options.origin,
		pairing: null,
		requests: [],
		devices: [] as Record<string, unknown>[],
		projects: options.projects
	};
	const copy = () => JSON.parse(JSON.stringify(status));
	const done = async (op: string, input: object, change: Change) => {
		host.__calls.push({ op, ...input });
		Object.assign(status, change);
		listeners.forEach((listener) => listener(copy()));
		return copy();
	};
	const at = new Date(Date.now() + 300000).toISOString();
	const { deviceId, name } = options.phone;
	const asking = { deviceId, deviceName: name, platform: 'ios', requestedAt: at, expiresAt: at };
	/** A phone scanned the offer: the desktop now shows who asks, with the identity of its key. */
	const request = () => {
		const open = status.pairing as { pairingId: string } | null;
		const pairingId = open?.pairingId ?? options.pairing.pairingId;
		void done('fixture.request', {}, { requests: [{ pairingId, ...asking }] });
	};
	host.__remoteHost = { status, listeners, copy, done, request };
}

/** SYNTHETIC `window.harnessRemote`: the operations of the desktop control port. */
function installHostPort(options: HostOptions) {
	const host = window as unknown as RemoteHost;
	const { status, listeners, copy, done } = host.__remoteHost;
	const expiresAt = new Date(Date.now() + 300000).toISOString();
	const ids = [options.pairing.pairingId, ...options.later];
	/** SYNTHETIC offer: the text a QR code holds, for a host and a relay that do not exist. */
	const offered = () => {
		const { hostId, code } = options.pairing;
		const pairingId = ids.shift() ?? 'e5'.repeat(16);
		const ends = Date.now() + options.ttlMs;
		const fields = `exp=${Math.floor(ends / 1000)};host=${hostId};pairing=${pairingId};code=${code}`;
		const scan = `harness-pair:v1;aud=harness-phone;env=production;${fields};origin=${options.origin}`;
		const { origin } = options;
		return { hostId, pairingId, code, origin, scan, expiresAt: new Date(ends).toISOString() };
	};
	const { deviceId, name } = options.phone;
	const approved = { deviceId, name, platform: 'ios', approvedAt: expiresAt, lastSeenAt: null };
	const closed = { enabled: false, state: 'disabled', pairing: null, requests: [] };
	host.harnessRemote = {
		status: async () => copy(),
		enable: () => done('remote.enable', {}, { enabled: true, state: 'online' }),
		disable: () => done('remote.disable', {}, closed),
		createPairing: async () => {
			const offer = offered();
			await done('remote.createPairing', {}, { pairing: offer, requests: [] });
			return offer;
		},
		closePairing: () => done('remote.closePairing', {}, { pairing: null, requests: [] }),
		/** Like the host: an approval that does not name the phone that was shown is refused. */
		approvePairing: (input: Grant) =>
			done(
				'remote.approvePairing',
				input,
				input.deviceId !== deviceId
					? {}
					: {
							pairing: null,
							requests: [],
							devices: [{ ...approved, ...input, pairingId: undefined, online: true }]
						}
			),
		/** Like the host: a denied request spends the offer it came with. */
		denyPairing: (input: object) =>
			done('remote.denyPairing', input, { requests: [], pairing: null }),
		revokeDevice: (input: { deviceId: string }) =>
			done('remote.revokeDevice', input, {
				devices: status.devices.filter((item) => item.deviceId !== input.deviceId)
			}),
		onStatus: (listener: Listener) => {
			listeners.add(listener);
			return () => listeners.delete(listener);
		}
	};
}

/** The two-local-one-shared Electron bridge, with the synthetic desktop control port beside it. */
export async function remoteHostFixture(page: Page, enabled = false, ttlMs = 300000) {
	const outbox = await projectFixture(page);
	const projects = [
		{ id: alpha, name: 'Alpha' },
		{ id: beta, name: 'Beta' }
	];
	const options: HostOptions = {
		enabled,
		origin: relayOrigin,
		ttlMs,
		later: laterPairings,
		pairing,
		phone,
		projects
	};
	await page.addInitScript(installHostState, options);
	await page.addInitScript(installHostPort, options);
	return outbox;
}
