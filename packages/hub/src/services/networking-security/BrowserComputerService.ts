// @harness-uid u_edfppauhtv
import {
	DeviceConnectionService,
	DevicePairingService,
	RemoteFailure,
	randomId,
	remoteLimits,
	remotePatterns,
	type RemoteGrant,
	type RemoteKeyPair,
	type RemoteSocket
} from '../../../../remote/src/index';
import type { BrowserApi } from '../../utils/browserApi';

const client = { kind: 'web', name: 'Web browser' } as const;

function browserSocket(path: string): RemoteSocket {
	const url = new URL(path, location.href);
	url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
	const socket = new WebSocket(url);
	const opened = new Promise<void>((resolve, reject) => {
		socket.addEventListener('open', () => resolve(), { once: true });
		const fail = () =>
			reject(new RemoteFailure('failed', 'Could not open the computer connection.'));
		socket.addEventListener('error', fail, { once: true });
		socket.addEventListener('close', fail, { once: true });
	});
	const ping = setInterval(() => {
		if (socket.readyState === WebSocket.OPEN) socket.send('ping');
	}, remoteLimits.pingMs);
	socket.addEventListener('close', () => clearInterval(ping), { once: true });
	return {
		opened,
		send: (text) => socket.send(text),
		close: (code) => socket.close(code),
		onMessage: (listener) =>
			socket.addEventListener('message', (event) => {
				if (typeof event.data === 'string') listener(event.data);
			}),
		onClose: (listener) => socket.addEventListener('close', (event) => listener(event.code))
	};
}

function pairingFetch(
	api: BrowserApi,
	signal: AbortSignal,
	path: string,
	pairingId: string
): typeof fetch {
	return (async (target: string | Request | URL, init?: RequestInit) => {
		signal.throwIfAborted();
		const operation = new URL(String(target)).pathname.split('/').at(-1);
		if (operation !== 'poll' && operation !== 'exchange')
			throw new RemoteFailure('failed', 'Invalid computer connection operation.');
		const body = JSON.parse(String(init?.body));
		const answer = await api.send('POST', `${path}/${pairingId}/${operation}`, body);
		return Response.json(answer);
	}) as typeof fetch;
}

/** A browser connection to one Mac. The Hub cookie stays out of the wire client and URLs. */
export class BrowserComputerService {
	private connection: DeviceConnectionService | undefined;
	private ready: Promise<DeviceConnectionService> | undefined;
	private readonly cancel = new AbortController();

	constructor(
		private readonly api: BrowserApi,
		private readonly keys?: (hostId: string) => Promise<RemoteKeyPair>
	) {}

	async connect(hostId: string, lost: () => void): Promise<RemoteGrant['projects']> {
		const connection = await this.open(hostId, lost);
		try {
			const projects = await connection.wire.request<RemoteGrant['projects']>('listProjects');
			return projects.map(({ id, name }) => ({ id, name }));
		} catch (error) {
			this.close();
			throw error;
		}
	}

	/**
	 * The Home view this computer shares with the signed-in account. The connection stays open
	 * for the next read, and nothing is stored on the way.
	 */
	async home(hostId: string, lost: () => void): Promise<unknown> {
		try {
			this.ready ??= this.open(hostId, lost);
			return await (await this.ready).wire.request<unknown>('homeSnapshot');
		} catch (error) {
			this.close();
			throw error;
		}
	}

	/** One answer or note for this computer's Tracker, on the connection `home` already opened. */
	async chat(message: object): Promise<unknown> {
		return this.homeRequest('homeChat', { ...message });
	}

	/** One Tracker document, over the same connection as the open ask that names it. */
	async readDocument(itemId: string, id: string): Promise<unknown> {
		return this.homeRequest('homeDocument', { itemId, id });
	}

	private async homeRequest(method: 'homeChat' | 'homeDocument', input: Record<string, unknown>) {
		if (!this.ready) throw new RemoteFailure('offline');
		return (await this.ready).wire.request<unknown>(method, input);
	}

	private async open(hostId: string, lost: () => void): Promise<DeviceConnectionService> {
		if (!remotePatterns.hostId.test(hostId))
			throw new RemoteFailure('failed', 'Computer address is invalid.');
		const host = `/api/remote/hosts/${hostId}`;
		const credentials = await this.credentials(host, hostId);
		this.cancel.signal.throwIfAborted();
		const path = `${host}/connect/${credentials.deviceId}`;
		const connection = new DeviceConnectionService({
			credentials,
			client,
			open: () => browserSocket(path)
		});
		this.connection = connection;
		connection.onStatus((state) => {
			if (state !== 'online' && !this.cancel.signal.aborted) lost();
		});
		try {
			await connection.connect();
			return connection;
		} catch (error) {
			this.close();
			throw error;
		}
	}

	close(): void {
		this.cancel.abort();
		this.connection?.close();
		this.connection?.wire.close();
		this.connection = undefined;
		this.ready = undefined;
	}

	private async credentials(host: string, hostId: string) {
		const path = `${host}/pairing`;
		const info = await this.api.get<{ hostId: string; origin: string; hostKey: string }>(path);
		this.cancel.signal.throwIfAborted();
		if (info.hostId !== hostId)
			throw new RemoteFailure('failed', 'The Hub answered for a different computer.');
		const pairingId = randomId();
		const pairing = new DevicePairingService({
			fetch: pairingFetch(this.api, this.cancel.signal, path, pairingId)
		});
		const input = {
			...info,
			pairingId,
			code: '',
			deviceName: client.name,
			platform: 'web' as const
		};
		const keys = await this.keys?.(hostId);
		this.cancel.signal.throwIfAborted();
		const pending = await pairing.requestAccount(
			input,
			info.hostKey,
			(body) => this.api.send('POST', path, { pairingId, ...body }).then(() => undefined),
			keys
		);
		const deadline = Date.now() + 20_000;
		do {
			this.cancel.signal.throwIfAborted();
			const status = await pairing.poll(pending);
			if (status === 'approved') return pairing.exchange(pending);
			if (status !== 'requested') break;
			await new Promise((resolve) => setTimeout(resolve, 350));
		} while (Date.now() < deadline);
		throw new RemoteFailure('failed', 'The computer did not accept the connection.');
	}
}
