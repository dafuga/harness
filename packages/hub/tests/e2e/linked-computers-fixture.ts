import { expect, type Page } from '../../../../test/support/browserTest';
import {
	HostPairingService,
	SecureChannelService,
	WireSessionService,
	fromBase64Url,
	randomCredential,
	remoteIdentity,
	remoteKeys,
	toBase64Url
} from '../../../remote/src/index';
import type { RemoteGrant, RemoteKeyPair } from '../../../remote/src/index';
import type { HostPairingFrame } from '../../../desktop/src/services/networking-security/remote-host-service/host-pairing-service/HostPairingService.types';

const project = { id: 'local-' + 'b'.repeat(64), name: 'Desk project' };

/** A synthetic signed-in Hub and Mac, speaking the real encrypted wire protocol. */
export async function linkedComputersFixture(
	page: Page,
	home?: unknown,
	/** Collects what the Mac is asked to write; without it the Mac offers no `homeChat`. */
	chats?: unknown[]
) {
	const keys = await remoteKeys();
	const hostId = await remoteIdentity(keys.publicKey);
	const host = { id: hostId, name: 'Desk Mac', platform: 'darwin' };
	const offline = { hostId: 'b'.repeat(40), name: 'Studio Mac', online: false };
	const origin = 'https://relay.example.invalid';
	const grant = { projects: [project], comments: false, agents: false };
	const pairing = new HostPairingService({ hostId, keys });
	const endpoint = `/api/remote/hosts/${hostId}/pairing`;
	let includeOffline = true;
	let device: Awaited<ReturnType<typeof pairing.approve>> | undefined;
	await page.route(/\/api\/remote\/hosts\?linked=1$/, (route) =>
		route.fulfill({
			json: {
				computers: [{ hostId, name: host.name, online: true }, ...(includeOffline ? [offline] : [])]
			}
		})
	);
	await page.route('**/api/remote/hosts/' + offline.hostId, (route) => {
		expect(route.request().method()).toBe('DELETE');
		includeOffline = false;
		return route.fulfill({ json: { ok: true } });
	});
	await page.route('**' + endpoint, async (route) => {
		const request = route.request();
		if (request.method() === 'GET')
			return route.fulfill({ json: { hostId, origin, hostKey: toBase64Url(keys.publicKey) } });
		const frame = request.postDataJSON() as HostPairingFrame;
		const expiresAt = new Date(Date.now() + 30_000).toISOString();
		const pending = await pairing.receive({ ...frame, account: true, expiresAt });
		if (!pending) return route.fulfill({ status: 400, json: { error: 'invalid-input' } });
		device = await pairing.approve(frame.pairingId, {
			deviceId: pending.deviceId,
			grant,
			hostName: host.name,
			generation: 1
		});
		return route.fulfill({ status: 202, json: { state: 'requested', expiresAt } });
	});
	await page.route('**' + endpoint + '/*/poll', (route) =>
		route.fulfill({ json: { state: 'approved' } })
	);
	await page.route('**' + endpoint + '/*/exchange', (route) =>
		route.fulfill({
			json: { deviceId: device?.deviceId, sealed: device?.sealed, credential: randomCredential() }
		})
	);
	await connectFixture(page, { host, keys, grant, home, chats, device: () => device! });
}

async function connectFixture(
	page: Page,
	input: {
		host: { id: string; name: string; platform: string };
		keys: RemoteKeyPair;
		grant: RemoteGrant;
		/** What the Mac answers to `homeSnapshot`; without it the method is not offered. */
		home?: unknown;
		chats?: unknown[];
		device: () => Awaited<ReturnType<HostPairingService['approve']>>;
	}
) {
	const { host, keys, grant, home, chats, device } = input;
	const offered = [
		'listProjects' as const,
		...(home === undefined ? [] : ['homeSnapshot' as const]),
		...(chats ? ['homeChat' as const] : [])
	];
	await page.routeWebSocket('**/api/remote/hosts/' + host.id + '/connect/*', (socket) => {
		const approved = device();
		const channel = new SecureChannelService({
			role: 'host',
			hostId: host.id,
			deviceId: approved.deviceId,
			staticKey: keys,
			peerKey: fromBase64Url(approved.deviceKey),
			generation: 1
		});
		const wire = new WireSessionService({
			role: 'device',
			methods: () => offered,
			describe: () => ({ host, device: { id: approved.deviceId, name: 'Web browser' }, grant }),
			handle: async (request) => {
				if (request.method === 'homeChat') {
					chats?.push(request.input);
					return { id: (request.input as { id: string }).id, status: 'sent' };
				}
				return request.method === 'homeSnapshot' ? home : [project];
			}
		});
		const link = wire.connect(
			(text) => void channel.seal(text, (frame) => socket.send(JSON.stringify(frame)))
		);
		socket.onClose(() => link.close());
		socket.onMessage(async (message) => {
			if (message === 'ping') return socket.send('pong');
			const frame = JSON.parse(String(message));
			if (frame.type === 'hello') return socket.send(JSON.stringify(await channel.answer(frame)));
			const text = await channel.open(frame);
			if (text) await link.receive(text);
		});
	});
}
