import {
	credentialHash,
	randomId,
	relayCloseCodes,
	safeEqual
} from '../../../../../remote/src/index';
import type { HostSocketsAdapter } from './HostSocketsAdapter';
import type { HostStorageAdapter } from './HostStorageAdapter';
import { relayConfig } from '../../../configs/networking-security/relayConfig';
import type {
	ConnectClaims,
	HostRecord
} from '../../../models/networking-security/RelayHost.types';
import { connectClaims } from '../../../utils/development-tooling/connectClaims';
import { relayError } from '../../../utils/networking-security/relayResponse';
import type { HostLinkService } from './HostLinkService';
import type { RateLimitService } from './RateLimitService';

/** Decides whether a connect request becomes a socket, and of whom. */
export class SocketAcceptService {
	constructor(
		private readonly store: HostStorageAdapter,
		private readonly sockets: HostSocketsAdapter,
		private readonly link: HostLinkService,
		private readonly rate: RateLimitService
	) {}

	/**
	 * The hash of the presented credential is computed first. Then, without awaiting anything,
	 * it is compared with the hash that is stored now and the socket is accepted: a credential
	 * that is rotated or revoked in the meantime opens nothing.
	 */
	async accept(request: Request): Promise<Response> {
		if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
			return relayError(426, 'upgrade-required', { Upgrade: 'websocket' });
		}
		const claims = connectClaims(request.headers);
		const hostId = this.store.host()?.hostId;
		if (!claims || !hostId) return relayError(401, 'credential-invalid');
		const { role, deviceId, credential } = claims;
		const hash = await credentialHash({ role, hostId, deviceId, credential });
		const host = this.store.host();
		if (!host || !safeEqual(hash, this.expected(host, claims))) return this.refuse(host);
		const client = role === 'host' ? this.host(host) : this.device(deviceId);
		return new Response(null, { status: 101, webSocket: client });
	}

	private expected(host: HostRecord, claims: ConnectClaims): string {
		if (claims.role === 'host') return host.credentialHash;
		return this.store.device(claims.deviceId)?.credentialHash ?? '';
	}

	/**
	 * A failed connect is counted per host. Beyond the limit of a window it is answered 429 and
	 * no longer written. A valid credential is never refused for the failures of others, so a
	 * phone that keeps trying a revoked credential cannot lock its host out.
	 */
	private refuse(host: HostRecord | undefined): Response {
		const counted = !host || this.rate.hit('connect', relayConfig.failedConnects);
		return counted ? relayError(401, 'credential-invalid') : relayError(429, 'rate-limited');
	}

	/** One socket per host: a newer one replaces the older one. */
	private host(record: HostRecord): WebSocket {
		const previous = this.sockets.host();
		const { client, server } = this.sockets.open({ role: 'host', closed: false });
		if (previous) this.link.drop(previous, relayCloseCodes.replaced);
		this.link.welcome(server, record);
		return client;
	}

	/** One socket per device, under a connection id that names this socket and no later one. */
	private device(deviceId: string): WebSocket {
		const previous = this.sockets.device(deviceId);
		const connectionId = randomId();
		const { client } = this.sockets.open({ role: 'device', deviceId, connectionId, closed: false });
		for (const socket of previous) this.link.drop(socket, relayCloseCodes.replaced);
		this.link.seen(deviceId);
		this.link.toHost({ type: 'device-open', deviceId, connectionId });
		return client;
	}
}
