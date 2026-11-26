// @harness-uid u_q4lqkd522a
import type { Attachment } from './SyncSockets.types';
import { frameScope, isScopeId, numbered, syncLimits } from './syncWire';
import type { SyncRing } from './SyncRing';

/** The viewers of the account, kept by the runtime (WebSocket Hibernation API). */
export class SyncSockets {
	constructor(
		private readonly state: DurableObjectState,
		private readonly ring: SyncRing
	) {}

	/** Accepts a viewer; the client end goes back to the Hub. */
	open(device: string): WebSocket {
		const pair = new WebSocketPair();
		const [client, server] = [pair[0], pair[1]];
		this.state.acceptWebSocket(server);
		server.serializeAttachment({ device, scopes: [] } satisfies Attachment);
		return client;
	}

	/** A subscribe message names scopes and the ring number the viewer last saw. */
	subscribe(socket: WebSocket, text: string, now: number): void {
		if (text.length > syncLimits.textBytes) return void socket.close(1009, 'too-large');
		const message = parse(text);
		const scopes = message?.scopes;
		if (message?.t !== 'subscribe' || !Array.isArray(scopes))
			return void socket.close(1008, 'invalid');
		const named = scopes
			.filter((scope): scope is string => typeof scope === 'string' && isScopeId(scope))
			.slice(0, syncLimits.scopesPerSocket);
		const attachment = socket.deserializeAttachment() as Attachment;
		socket.serializeAttachment({ ...attachment, scopes: named } satisfies Attachment);
		const after = Number.isSafeInteger(message.after) ? Number(message.after) : this.ring.head();
		socket.send(JSON.stringify({ t: 'subscribed', ring: this.ring.head() }));
		for (const frame of this.ring.since(after, new Set(named), now)) socket.send(frame);
	}

	/** Relays one sealed frame to the other viewers of its scope. */
	relay(from: WebSocket, frame: ArrayBuffer, now: number): void {
		const bytes = new Uint8Array(frame);
		const scope = bytes.length <= syncLimits.frameBytes ? frameScope(bytes) : null;
		if (!scope) return void from.close(1008, 'invalid');
		const numberedFrame = numbered(this.ring.push(scope, bytes, now), bytes);
		for (const socket of this.viewers(scope)) if (socket !== from) send(socket, numberedFrame);
	}

	/** Tells the viewers of a scope that its log grew. */
	poke(scope: string, seq: number, kind: string): void {
		const text = JSON.stringify({ t: 'poke', scope, seq, kind });
		for (const socket of this.viewers(scope)) send(socket, text);
	}

	/** Tells every viewer that a device is asking to sign in. */
	announce(message: { id: string; n: number }): void {
		this.everyone(JSON.stringify({ t: 'enroll', ...message }));
	}

	/** Tells every viewer to read a topic again. It carries no content. */
	changed(topic: string): void {
		this.everyone(JSON.stringify({ t: 'changed', topic }));
	}

	private everyone(text: string): void {
		for (const socket of this.state.getWebSockets()) send(socket, text);
	}

	private viewers(scope: string): WebSocket[] {
		return this.state.getWebSockets().filter((socket) => {
			const attachment = socket.deserializeAttachment() as Attachment | null;
			return attachment?.scopes.includes(scope) === true;
		});
	}
}

function parse(text: string): { t?: string; scopes?: unknown; after?: unknown } | null {
	try {
		const value: unknown = JSON.parse(text);
		return value && typeof value === 'object' ? value : null;
	} catch {
		return null;
	}
}

function send(socket: WebSocket, data: string | Uint8Array): void {
	try {
		socket.send(data);
	} catch {
		// A closing socket misses the message; the viewer catches up from the log.
	}
}
