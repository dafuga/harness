import { DurableObject } from 'cloudflare:workers';
import { PublicRelayController } from './lib/networking-security/relay/PublicRelayController';
import type { RelayEnv } from './models/networking-security/RelayHost.types';
import { hostRuntime, type HostRuntime } from './lib/execution-runtimes/host-runtime/hostRuntime';

/**
 * One per host (`env.REMOTE_HOSTS.idFromName(hostId)`): its registration, its devices, its
 * pairings and its sockets. Sockets are hibernatable; everything else is in storage, so the
 * object keeps nothing that matters in memory.
 */
export class RemoteHostObject extends DurableObject<RelayEnv> {
	readonly #runtime: HostRuntime;

	constructor(state: DurableObjectState, env: RelayEnv) {
		super(state, env);
		this.#runtime = hostRuntime(state, env);
		state.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
	}

	fetch(request: Request): Promise<Response> {
		return this.#runtime.http.handle(request);
	}

	webSocketMessage(socket: WebSocket, message: string | ArrayBuffer): Promise<void> {
		return this.#runtime.frames.message(socket, message);
	}

	webSocketClose(socket: WebSocket): void {
		this.#runtime.frames.closed(socket);
	}

	webSocketError(socket: WebSocket): void {
		this.#runtime.frames.closed(socket);
	}

	alarm(): Promise<void> {
		return this.#runtime.offers.sweep();
	}
}

/** The public Worker: contract §5.1 and nothing else. */
export default {
	fetch(request: Request, env: RelayEnv): Promise<Response> {
		return new PublicRelayController(env).handle(request);
	}
} satisfies ExportedHandler<RelayEnv>;
