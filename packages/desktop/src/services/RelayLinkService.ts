import { randomId, relayHeaders, relaySocketUrl } from '../../../remote/src/index';
import type { RelayHostCommand, RelayHostFrame, RemoteSocket } from '../../../remote/src/index';
import { relayFrame } from '../utils/relayFrame';

export type RelayLinkState = 'connecting' | 'online' | 'offline';
type Without<T, K extends string> = T extends unknown ? Omit<T, K> : never;
/** A command the relay acknowledges; the link adds its `ref`. */
export type RelayCommandInput = Without<Extract<RelayHostCommand, { ref: string }>, 'ref'>;
export interface RelayLinkOptions {
	open: (url: string, headers: Record<string, string>) => RemoteSocket;
	origin: string;
	hostId: string;
	credential: string;
	onFrame: (frame: RelayHostFrame) => void;
	onState: (state: RelayLinkState) => void;
	retryMs?: number[];
	pingMs?: number;
	idleMs?: number;
	ackMs?: number;
}
type Timer = ReturnType<typeof setTimeout>;
interface Waiting {
	resolve: () => void;
	reject: (error: Error) => void;
	timer: Timer;
}
const quiet = (timer: Timer): Timer => {
	(timer as { unref?: () => void }).unref?.();
	return timer;
};

/** This computer's outbound socket to the relay. No inbound port is ever opened. */
export class RelayLinkService {
	state: RelayLinkState = 'offline';
	private socket: RemoteSocket | null = null;
	private running = false;
	private attempt = 0;
	private heard = 0;
	private retry: Timer | null = null;
	private beat: Timer | null = null;
	private readonly acks = new Map<string, Waiting>();
	constructor(private readonly options: RelayLinkOptions) {}
	start(): void {
		if (this.running) return;
		this.running = true;
		this.connect();
	}
	/** Suspension, disabling or quit: the socket closes and nothing reconnects. */
	stop(): void {
		this.running = false;
		if (this.retry) clearTimeout(this.retry);
		const socket = this.socket;
		this.socket = null;
		socket?.close(1000);
		this.down();
	}
	send(command: RelayHostCommand): boolean {
		if (this.state !== 'online' || !this.socket) return false;
		this.socket.send(JSON.stringify(command));
		return true;
	}
	command(input: RelayCommandInput): Promise<void> {
		const ref = randomId(8);
		return new Promise((resolve, reject) => {
			if (!this.send({ ...input, ref } as RelayHostCommand))
				return reject(new Error('The relay is not connected.'));
			const expire = () => this.settle(ref, 'The relay did not answer.');
			const timer = quiet(setTimeout(expire, this.options.ackMs ?? 10000));
			this.acks.set(ref, { resolve, reject, timer });
		});
	}
	private connect(): void {
		const { origin, hostId, credential } = this.options;
		this.set('connecting');
		const headers = { Authorization: `Bearer ${credential}`, [relayHeaders.role]: 'host' },
			socket = this.options.open(relaySocketUrl(origin, hostId), headers);
		this.socket = socket;
		socket.onMessage((text) => this.receive(socket, text));
		socket.onClose(() => this.lost(socket));
		socket.opened.then(
			() => this.opened(socket),
			() => this.lost(socket)
		);
	}
	private opened(socket: RemoteSocket): void {
		if (socket !== this.socket) return;
		this.attempt = 0;
		this.heard = Date.now();
		this.set('online');
		this.beat = quiet(setInterval(() => this.pulse(socket), this.options.pingMs ?? 25000));
	}
	/** Silence beyond the idle bound means the socket is dead, whatever it claims. */
	private pulse(socket: RemoteSocket): void {
		if (Date.now() - this.heard <= (this.options.idleMs ?? 90000)) return socket.send('ping');
		socket.close(4408);
		this.lost(socket);
	}
	private receive(socket: RemoteSocket, text: string): void {
		if (socket !== this.socket) return;
		this.heard = Date.now();
		const frame = text === 'pong' ? null : relayFrame(text);
		if (frame?.type === 'ack')
			return this.settle(frame.ref, frame.ok ? undefined : (frame.error ?? 'refused'));
		if (frame) this.options.onFrame(frame);
	}
	private lost(socket: RemoteSocket): void {
		if (socket !== this.socket) return;
		this.socket = null;
		this.down();
		if (!this.running) return;
		const delays = this.options.retryMs ?? [1000, 2000, 5000, 15000, 30000],
			delay = delays[Math.min(this.attempt++, delays.length - 1)];
		this.retry = quiet(setTimeout(() => this.connect(), delay));
	}
	private down(): void {
		if (this.beat) clearInterval(this.beat);
		this.beat = null;
		for (const ref of [...this.acks.keys()]) this.settle(ref, 'The relay is not connected.');
		this.set('offline');
	}
	private settle(ref: string, error?: string): void {
		const waiting = this.acks.get(ref);
		if (!waiting) return;
		clearTimeout(waiting.timer);
		this.acks.delete(ref);
		if (error === undefined) waiting.resolve();
		else waiting.reject(new Error(error));
	}
	private set(state: RelayLinkState): void {
		if (this.state === state) return;
		this.state = state;
		this.options.onState(state);
	}
}
