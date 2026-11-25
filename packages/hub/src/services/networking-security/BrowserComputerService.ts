// @harness-uid u_edfppauhtv
import {
	DeviceConnectionService,
	DevicePairingService,
	RemoteFailure,
	randomId,
	remoteLimits,
	remotePatterns,
	type RemoteGrant,
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

/** A browser connection to one Mac. The Hub cookie stays out of the wire client and URLs. */
export class BrowserComputerService {
	private connection: DeviceConnectionService | undefined;
	private readonly cancel = new AbortController();

	constructor(private readonly api: BrowserApi) {}

	async connect(hostId: string, lost: () => void): Promise<RemoteGrant['projects']> {
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
			const projects = await connection.wire.request<RemoteGrant['projects']>('listProjects');
			return projects.map(({ id, name }) => ({ id, name }));
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
	}

	private async credentials(host: string, hostId: string) {
		const path = `${host}/pairing`;
		const info = await this.api.get<{ hostId: string; origin: string; hostKey: string }>(path);
		this.cancel.signal.throwIfAborted();
		if (info.hostId !== hostId)
			throw new RemoteFailure('failed', 'The Hub answered for a different computer.');
		const pairingId = randomId();
		const pairing = new DevicePairingService({ fetch: this.pairingFetch(path, pairingId) });
		const input = {
			...info,
			pairingId,
			code: '',
			deviceName: client.name,
			platform: 'web' as const
		};
		const pending = await pairing.requestAccount(input, info.hostKey, (body) =>
			this.api.send('POST', path, { pairingId, ...body }).then(() => undefined)
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

	private pairingFetch(path: string, pairingId: string): typeof fetch {
		return (async (target: string | Request | URL, init?: RequestInit) => {
			this.cancel.signal.throwIfAborted();
			const operation = new URL(String(target)).pathname.split('/').at(-1);
			if (operation !== 'poll' && operation !== 'exchange')
				throw new RemoteFailure('failed', 'Invalid computer connection operation.');
			const body = JSON.parse(String(init?.body));
			const answer = await this.api.send('POST', `${path}/${pairingId}/${operation}`, body);
			return Response.json(answer);
		}) as typeof fetch;
	}
}
