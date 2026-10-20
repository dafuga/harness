import { once } from 'node:events';
import type { IncomingMessage } from 'node:http';
import type { AddressInfo } from 'node:net';
import { WebSocketServer } from 'ws';
import type { RawData, WebSocket } from 'ws';
import {
	localTransport,
	randomBytes,
	remoteLimits,
	toBase64Url
} from '../../../../remote/src/index';
import type { LocalBootstrap } from '../../../../remote/src/index';

/** One accepted socket, as the client it belongs to sees it. Text frames only. */
export interface LocalSocket {
	send(text: string): void;
	close(code?: number): void;
	onText(listener: (text: string) => void): void;
	onClose(listener: () => void): void;
}
/** What a ticket was issued for: the client of one window. */
export interface LocalTransportTarget {
	attach(socket: LocalSocket): void;
}
export interface LocalTransportOptions {
	origin?: string;
	ticketMs?: number;
	tickets?: number;
	clients?: number;
	now?: () => number;
}
interface Ticket {
	target: LocalTransportTarget;
	expiresAt: number;
}
type Verdict = (accepted: boolean, code?: number, message?: string) => void;

function socketOf(socket: WebSocket): LocalSocket {
	socket.on('error', () => undefined);
	return {
		send: (text) => {
			if (socket.readyState === socket.OPEN) socket.send(text);
		},
		close: (code = 1000) => socket.close(code),
		onText: (listener) =>
			socket.on('message', (data: RawData, binary: boolean) =>
				binary ? socket.close(1003) : listener(data.toString())
			),
		onClose: (listener) => socket.on('close', () => listener())
	};
}

/**
 * The socket between the renderer and its own main process. It listens on the loopback address
 * only, accepts the app page only, and opens for a ticket that was handed to the preload of a
 * window over IPC moments before: one use, a few seconds, never part of an address.
 */
export class LocalTransportService {
	private server: WebSocketServer | null = null;
	private starting: Promise<number> | null = null;
	private readonly tickets = new Map<string, Ticket>();
	private readonly admitted = new WeakMap<IncomingMessage, LocalTransportTarget>();
	constructor(private readonly options: LocalTransportOptions = {}) {}
	get port(): number {
		return this.bound().port;
	}
	get address(): string {
		return this.bound().address;
	}
	get connections(): number {
		return this.server ? this.server.clients.size : 0;
	}
	listen(): Promise<number> {
		this.starting ??= this.start().catch((error: unknown) => {
			this.starting = null;
			throw error;
		});
		return this.starting;
	}
	private async start(): Promise<number> {
		const server = new WebSocketServer({
			host: '127.0.0.1',
			port: 0,
			maxPayload: remoteLimits.frameBytes,
			perMessageDeflate: false,
			handleProtocols: (offered) =>
				offered.has(localTransport.protocol) ? localTransport.protocol : false,
			verifyClient: (info, done) => this.verify(info.req, done)
		});
		await once(server, 'listening');
		server.on('connection', (socket, request) =>
			this.admitted.get(request)?.attach(socketOf(socket))
		);
		this.server = server;
		return this.port;
	}
	/** A fresh ticket for one client. Older ones give way when too many are waiting. */
	bootstrap(target: LocalTransportTarget): LocalBootstrap {
		const now = this.now(),
			limit = this.options.tickets ?? localTransport.tickets,
			life = this.options.ticketMs ?? localTransport.ticketMs;
		for (const [ticket, held] of this.tickets)
			if (held.expiresAt <= now) this.tickets.delete(ticket);
		for (const ticket of [...this.tickets.keys()].slice(0, this.tickets.size - limit + 1))
			this.tickets.delete(ticket);
		const ticket = toBase64Url(randomBytes(32));
		this.tickets.set(ticket, { target, expiresAt: now + life });
		return { port: this.port, ticket };
	}
	/** The window is gone: what was issued for it opens nothing any more. */
	forget(target: LocalTransportTarget): void {
		for (const [ticket, held] of this.tickets)
			if (held.target === target) this.tickets.delete(ticket);
	}
	async close(): Promise<void> {
		await this.starting?.catch(() => undefined);
		this.starting = null;
		const server = this.server;
		this.server = null;
		if (!server) return;
		for (const socket of server.clients) socket.terminate();
		await new Promise<void>((resolve) => server.close(() => resolve()));
	}
	private verify(request: IncomingMessage, done: Verdict): void {
		const header = String(request.headers['sec-websocket-protocol'] ?? ''),
			offered = header.split(',').map((item) => item.trim()),
			prefix = localTransport.ticketPrefix,
			tickets = offered.filter((item) => item.startsWith(prefix)),
			target = tickets.length === 1 ? this.take(tickets[0].slice(prefix.length)) : null;
		if (!this.addressed(request)) return done(false, 403, 'Forbidden');
		if (!target || !offered.includes(localTransport.protocol))
			return done(false, 401, 'Unauthorized');
		if (this.connections >= (this.options.clients ?? localTransport.clients))
			return done(false, 503, 'Service Unavailable');
		this.admitted.set(request, target);
		done(true);
	}
	/** The app page, this very port, the transport path. Nothing in an address is a credential. */
	private addressed(request: IncomingMessage): boolean {
		const { host, origin } = request.headers,
			expected = this.options.origin ?? localTransport.origin;
		return (
			request.url === localTransport.path &&
			host === `127.0.0.1:${this.port}` &&
			origin === expected
		);
	}
	/** A ticket is spent by being presented, whatever else is wrong with the request. */
	private take(ticket: string): LocalTransportTarget | null {
		const held = this.tickets.get(ticket);
		this.tickets.delete(ticket);
		return held && held.expiresAt > this.now() ? held.target : null;
	}
	private bound(): AddressInfo {
		const address = this.server ? this.server.address() : null;
		if (!address || typeof address === 'string') throw new Error('The transport is not listening.');
		return address;
	}
	private now(): number {
		return this.options.now ? this.options.now() : Date.now();
	}
}
