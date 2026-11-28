import type { OwnerHomeSnapshot } from '$reports/lib/projects-sessions/hub-home/hubHome.types';
import { agentOpenAsks } from '$reports/lib/projects-sessions/hub-home/homeOpenAsks';
import { captureNeedsYou } from './hub-home-capture';
import { needsYou } from './hub-home-click-through';
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

/** The signed-in account's computers; the offline one can be removed. */
async function computerListRoutes(
	page: Page,
	online: { hostId: string; name: string; online: boolean },
	offline: { hostId: string; name: string; online: boolean }
) {
	let includeOffline = true;
	await page.route(/\/api\/remote\/hosts\?linked=1$/, (route) =>
		route.fulfill({ json: { computers: [online, ...(includeOffline ? [offline] : [])] } })
	);
	await page.route('**/api/remote/hosts/' + offline.hostId, (route) => {
		expect(route.request().method()).toBe('DELETE');
		includeOffline = false;
		return route.fulfill({ json: { ok: true } });
	});
}

/** A synthetic signed-in Hub and Mac, speaking the real encrypted wire protocol. */
export async function linkedComputersFixture(
	page: Page,
	/** What the Mac answers to `homeSnapshot`, read again for every request when a function. */
	home?: unknown,
	/** Collects what the Mac is asked to write; without it the Mac offers no `homeChat`. */
	chats?: unknown[],
	/** The Mac's reply to one write; by default it was sent. */
	answer?: (input: never) => unknown
) {
	const keys = await remoteKeys();
	const hostId = await remoteIdentity(keys.publicKey);
	const host = { id: hostId, name: 'Desk Mac', platform: 'darwin' };
	const offline = { hostId: 'b'.repeat(40), name: 'Studio Mac', online: false };
	const origin = 'https://relay.example.invalid';
	const grant = { projects: [project], comments: false, agents: false };
	const pairing = new HostPairingService({ hostId, keys });
	const endpoint = `/api/remote/hosts/${hostId}/pairing`;
	let device: Awaited<ReturnType<typeof pairing.approve>> | undefined;
	const online = { hostId, name: host.name, online: true };
	await computerListRoutes(page, online, offline);
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
	await connectFixture(page, { host, keys, grant, home, chats, answer, device: () => device! });
	return online;
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
		answer?: (input: never) => unknown;
		device: () => Awaited<ReturnType<HostPairingService['approve']>>;
	}
) {
	const { host, keys, grant, home, chats, answer, device } = input;
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
					if (answer) return answer(request.input as never);
					return { id: (request.input as { id: string }).id, status: 'sent' };
				}
				if (request.method !== 'homeSnapshot') return [project];
				return typeof home === 'function' ? (home as () => unknown)() : home;
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

export async function proveCoSDeliveryAskClears(
	page: Page,
	snapshot: OwnerHomeSnapshot,
	chats: unknown[]
) {
	const since = new Date(Date.now() - 60_000).toISOString();
	const alarm = {
		itemId: 'sbb0mckfxs',
		agentId: 'tracker',
		agentName: 'Tracker',
		title: 'Tracker alerts are not reaching Chief of Staff',
		question: 'Four Tracker alerts have not reached Chief of Staff. What should happen?',
		options: [
			{ label: 'Check CoS', effect: '', recommended: true },
			{ label: 'Wait', effect: '' }
		],
		since
	};
	const questions = snapshot.openAsks ?? agentOpenAsks(snapshot.agents);
	const stale = await linkedComputersFixture(
		page,
		{ ...snapshot, openAsks: [...questions, alarm] },
		chats
	);
	let answered = false;
	const fresh = await linkedComputersFixture(page, () => ({
		...snapshot,
		openAsks: answered ? questions : [...questions, alarm],
		...(answered && {
			closedCosDeliveryAsks: [{ itemId: alarm.itemId, closedAt: new Date().toISOString() }]
		})
	}));
	await page.route(/\/api\/remote\/hosts\?linked=1$/, (route) =>
		route.fulfill({ json: { computers: [stale, fresh] } })
	);
	await page.goto('/?view=needs-you');
	const reminder = needsYou(page).getByText(alarm.question, { exact: true });
	await expect(reminder).toBeVisible();
	answered = true;
	await page.reload();
	await expect(needsYou(page).getByText(questions[0].question, { exact: true })).toBeVisible();
	await captureNeedsYou(page, 'hub-cos-delivery-answered', needsYou(page));
	await expect(reminder).toHaveCount(0);
}
