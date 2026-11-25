// @harness-uid u_hbhmrjigug
import { DurableObject } from 'cloudflare:workers';
import type { RelayEnv } from '../../../models/networking-security/RelayHost.types';
import { SyncEnrollments } from './SyncEnrollments';
import { SyncHttp } from './SyncHttp';
import { SyncRing } from './SyncRing';
import { SyncSockets } from './SyncSockets';
import { syncLimits } from './syncWire';

/**
 * One per account (`idFromName(account)`): the fan-out of the sealed sync. It forwards pokes and
 * sealed stream frames to the viewers that asked for a scope, keeps a short ring of frames and a
 * mailbox of sign-in requests. It never holds a key and never opens a frame; the Hub reaches it
 * through a namespace binding after checking the session.
 */
export class AccountSyncObject extends DurableObject<RelayEnv> {
	readonly #enrollments: SyncEnrollments;
	readonly #sockets: SyncSockets;
	readonly #http: SyncHttp;

	constructor(state: DurableObjectState, env: RelayEnv) {
		super(state, env);
		const sql = state.storage.sql;
		this.#enrollments = new SyncEnrollments(sql);
		this.#sockets = new SyncSockets(state, new SyncRing(sql));
		this.#http = new SyncHttp({
			sockets: this.#sockets,
			enrollments: this.#enrollments,
			now: () => Date.now(),
			sweep: () => state.storage.setAlarm(Date.now() + syncLimits.enrollmentMs + 1000)
		});
		state.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
	}

	fetch(request: Request): Promise<Response> {
		return this.#http.handle(request);
	}

	webSocketMessage(socket: WebSocket, message: string | ArrayBuffer): void {
		if (typeof message === 'string') this.#sockets.subscribe(socket, message, Date.now());
		else this.#sockets.relay(socket, message, Date.now());
	}

	alarm(): Promise<void> {
		this.#enrollments.expire(Date.now());
		if (!this.#enrollments.any()) return Promise.resolve();
		return this.ctx.storage.setAlarm(Date.now() + syncLimits.enrollmentMs + 1000);
	}
}
