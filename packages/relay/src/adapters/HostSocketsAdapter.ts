import type { SocketAttachment } from '../models/RelayHost.types';

/** `WebSocket.OPEN`: the only state in which a socket still counts. */
const open = 1;

/**
 * The sockets of a host object, kept by the runtime (WebSocket Hibernation API). Nothing about
 * a socket lives in memory: who it is travels in its attachment and its tags, so the object can
 * sleep between frames and still find every connection afterwards.
 */
export class HostSocketsAdapter {
	constructor(private readonly state: DurableObjectState) {}

	/** Accepts the relay end of a new pair and returns both ends. */
	open(attachment: SocketAttachment): { client: WebSocket; server: WebSocket } {
		const pair = new WebSocketPair();
		const [client, server] = [pair[0], pair[1]];
		this.state.acceptWebSocket(server, tagsOf(attachment));
		server.serializeAttachment(attachment);
		return { client, server };
	}

	attachment(socket: WebSocket): SocketAttachment | undefined {
		return (socket.deserializeAttachment() as SocketAttachment | null) ?? undefined;
	}

	/** The open socket of the host, if any. */
	host(): WebSocket | undefined {
		return this.live('host')[0];
	}

	/** Every open socket of every device. */
	devices(): WebSocket[] {
		return this.live('device');
	}

	device(deviceId: string): WebSocket[] {
		return this.live(`device:${deviceId}`);
	}

	connection(connectionId: string): WebSocket | undefined {
		return this.live(`connection:${connectionId}`)[0];
	}

	/** Every socket the runtime still holds, open or closing. */
	all(): WebSocket[] {
		return this.state.getWebSockets();
	}

	/** Sends one JSON text frame. False when the socket is gone; nothing is kept for later. */
	send(socket: WebSocket, frame: unknown): boolean {
		try {
			socket.send(JSON.stringify(frame));
			return true;
		} catch {
			return false;
		}
	}

	/** Ends a socket. It stops counting at once, whenever the peer completes the close. */
	close(socket: WebSocket, code: number): void {
		try {
			const attachment = this.attachment(socket);
			if (attachment) socket.serializeAttachment({ ...attachment, closed: true });
			socket.close(code, 'closed');
		} catch {
			// The socket was closed already.
		}
	}

	private live(tag: string): WebSocket[] {
		return this.state
			.getWebSockets(tag)
			.filter((socket) => socket.readyState === open && this.attachment(socket)?.closed === false);
	}
}

function tagsOf(attachment: SocketAttachment): string[] {
	if (attachment.role === 'host') return ['host'];
	return ['device', `device:${attachment.deviceId}`, `connection:${attachment.connectionId}`];
}
