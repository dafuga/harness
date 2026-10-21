import { WireClientService, WireFramingService, localTransport } from '../../../remote/src/index';
import type { LocalBootstrap, RemoteMethod, WireChannel } from '../../../remote/src/index';

/** The WebSocket of a page, or anything shaped like it. */
export interface LocalSocketPort {
	send(text: string): void;
	close(): void;
	onopen: ((event: unknown) => void) | null;
	onmessage: ((event: { data: unknown }) => void) | null;
	onclose: ((event: unknown) => void) | null;
}
export interface LocalTransportClientOptions {
	/** Asks the main process for a ticket. In the app this is the one IPC call of the preload. */
	bootstrap: () => Promise<LocalBootstrap>;
	open: (url: string, protocols: string[]) => LocalSocketPort;
	retryMs?: number[];
	deadlineMs?: number;
}
const unreachable = 'The desktop backend cannot be reached.';
/** A person may leave a dialog open for a long time. */
const patient = 6 * 60 * 60 * 1000;

/**
 * The preload's end of the loopback socket. The ticket lives in this object for the moment it
 * takes to open the socket: it is sent as a subprotocol, never put into an address, never
 * stored, and never handed to the page.
 */
export class LocalTransportClientService {
	readonly wire: WireClientService;
	private socket: LocalSocketPort | null = null;
	private connecting: Promise<void> | null = null;
	private attempts = 0;
	private stopped = false;
	constructor(private readonly options: LocalTransportClientOptions) {
		const deadlineMs = options.deadlineMs ?? patient;
		this.wire = new WireClientService({
			client: { kind: 'electron', name: 'Harness' },
			deadlineMs
		});
	}
	/** `input` is copied: nothing of the caller's object is kept or changed. */
	async request<T = unknown>(method: RemoteMethod, input: object = {}): Promise<T> {
		await this.ready();
		return this.wire.request<T>(method, { ...input });
	}
	on(channel: WireChannel, listener: (value: unknown) => void): () => void {
		return this.wire.on(channel, listener);
	}
	close(): void {
		this.stopped = true;
		const socket = this.socket;
		this.socket = null;
		socket?.close();
		this.wire.close();
	}
	/** One attempt at a time. A failed one is forgotten, so the next request tries again. */
	private ready(): Promise<void> {
		if (this.stopped) return Promise.reject(new Error(unreachable));
		this.connecting ??= this.connect().catch((error: unknown) => {
			this.connecting = null;
			throw error;
		});
		return this.connecting;
	}
	private async connect(): Promise<void> {
		const { port, ticket } = await this.options.bootstrap(),
			protocols = [localTransport.protocol, localTransport.ticketPrefix + ticket],
			socket = this.options.open(`ws://127.0.0.1:${port}${localTransport.path}`, protocols);
		const framing = new WireFramingService({
			write: (frame) => socket.send(frame),
			outgoingBytes: localTransport.requestBytes
		});
		await new Promise<void>((resolve, reject) => {
			socket.onopen = () => resolve();
			socket.onclose = () => reject(new Error(unreachable));
		});
		socket.onmessage = (event) => this.receive(socket, framing, event.data);
		socket.onclose = () => this.lost(socket);
		this.socket = socket;
		await this.wire.bind((text) => framing.send(text));
		this.attempts = 0;
	}
	private receive(socket: LocalSocketPort, framing: WireFramingService, data: unknown): void {
		try {
			const text = typeof data === 'string' ? framing.accept(data) : null;
			if (text !== null) this.wire.receive(text);
		} catch {
			socket.close();
		}
	}
	/** The socket ended. Events should keep coming, so a new one is opened without being asked. */
	private lost(socket: LocalSocketPort): void {
		if (socket !== this.socket) return;
		this.socket = null;
		this.connecting = null;
		this.wire.unbind();
		if (this.stopped) return;
		const delays = this.options.retryMs ?? [250, 1000, 2000, 5000],
			delay = delays[Math.min(this.attempts++, delays.length - 1)];
		setTimeout(() => void this.ready().catch(() => undefined), delay);
	}
}
