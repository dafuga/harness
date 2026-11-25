// @harness-uid u_sfqm2yuzvp
import { WebSocket } from 'ws';
import { toBase64Url } from '../../../../remote/src/utils/networking-security/remoteBytes';
import type {
	SessionStreamTarget,
	SessionStreamTransport
} from './SessionStreamPublisherService.types';

import { SessionPublishError } from './SessionPublishError';

const timeoutMs = 10_000;

/** Native HTTPS and WebSocket transport. The publisher gives it only sealed bytes. */
export class SessionSyncTransport implements SessionStreamTransport {
	private readonly base: URL;
	private readonly headers: Record<string, string>;
	private socket?: WebSocket;

	constructor(target: Pick<SessionStreamTarget, 'origin' | 'device' | 'bearer'>) {
		const origin = new URL(target.origin);
		if (origin.protocol !== 'https:' || origin.href !== origin.origin + '/')
			throw new SessionPublishError('Session sync requires a trusted HTTPS origin.');
		this.base = new URL('/api/sync/v1/', origin);
		this.headers = {
			Authorization: `Bearer ${target.bearer}`,
			'X-Harness-Device': target.device
		};
	}

	async readRevision(scope: string, id: string): Promise<bigint> {
		const response = await this.request(scope, id, { method: 'GET' });
		if (response.status === 404) return 0n;
		const revision = response.headers.get('X-Sealed-Revision');
		if (!response.ok || !revision || !/^\d{1,16}$/.test(revision))
			throw new SessionPublishError(`Session revision lookup failed (${response.status}).`);
		return BigInt(revision);
	}

	async putObject(scope: string, id: string, body: Uint8Array): Promise<void> {
		const response = await this.request(scope, id, { method: 'PUT', body: toBase64Url(body) });
		if (response.status !== 201)
			throw new SessionPublishError(`Session object write failed (${response.status}).`);
	}

	async sendFrame(frame: Uint8Array): Promise<void> {
		const socket = this.socket?.readyState === WebSocket.OPEN ? this.socket : await this.connect();
		await new Promise<void>((resolve, reject) => {
			const timeout = setTimeout(() => {
				socket.terminate();
				reject(new SessionPublishError('Session live write timed out.'));
			}, timeoutMs);
			socket.send(frame, { binary: true }, (error) => {
				clearTimeout(timeout);
				if (error) reject(new SessionPublishError('Session live write failed.'));
				else resolve();
			});
		});
	}

	close(): void {
		this.socket?.terminate();
		this.socket = undefined;
	}

	private async request(scope: string, id: string, init: RequestInit): Promise<Response> {
		if (!/^[\w-]{22}$/.test(scope) || !/^[\w-]{43}$/.test(id))
			throw new SessionPublishError('Invalid sealed session object address.');
		try {
			const response = await fetch(new URL(`objects/${scope}/${id}`, this.base), {
				...init,
				headers: this.headers,
				redirect: 'error',
				signal: AbortSignal.timeout(timeoutMs)
			});
			await response.body?.cancel();
			return response;
		} catch {
			throw new SessionPublishError('Session object request failed.');
		}
	}

	private async connect(): Promise<WebSocket> {
		this.close();
		const url = new URL('live', this.base);
		url.protocol = 'wss:';
		const socket = new WebSocket(url, {
			headers: this.headers,
			followRedirects: false,
			handshakeTimeout: timeoutMs
		});
		this.socket = socket;
		await new Promise<void>((resolve, reject) => {
			const fail = () => reject(new SessionPublishError('Session live connection failed.'));
			socket.once('open', resolve);
			socket.on('error', fail);
			socket.once('close', fail);
		});
		return socket;
	}
}
