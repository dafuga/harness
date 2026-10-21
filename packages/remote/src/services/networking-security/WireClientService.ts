import {
	REMOTE_PROTOCOL,
	RemoteFailure,
	attachMethod,
	mutationMethods,
	remoteLimits
} from '../../models/networking-security/Remote.types';
import type {
	AttachInput,
	RemoteAttachment,
	RemoteMethod,
	RemoteResume,
	WireChannel,
	WireEvent,
	WireRequest
} from '../../models/networking-security/Remote.types';
import { WireMessageValidator } from '../../validators/networking-security/WireMessageValidator';

export interface WireClientOptions {
	client: AttachInput['client'];
	/** How long a request waits for its answer, across reconnects. */
	deadlineMs?: number;
	uuid?: () => string;
}
type Listener = (value: unknown) => void;
interface Waiting {
	request: WireRequest;
	resolve: (value: unknown) => void;
	reject: (error: Error) => void;
	timer: ReturnType<typeof setTimeout>;
}

/**
 * The client side of the wire protocol over any transport: answers by request id, events once
 * and in order, and after a reconnect the same requests again under their original ids.
 */
export class WireClientService {
	attachment: RemoteAttachment | null = null;
	private send: ((text: string) => void) | null = null;
	private bound = false;
	private closed = false;
	private attaching: string | null = null;
	private cursor: RemoteResume | null = null;
	private readonly waiting = new Map<string, Waiting>();
	private readonly listeners = new Map<WireChannel, Set<Listener>>();
	private readonly messages = new WireMessageValidator();
	constructor(private readonly options: WireClientOptions) {}

	/** A new connection: attach with the resume point, then re-send what was never answered. */
	async bind(send: (text: string) => void): Promise<RemoteAttachment> {
		if (this.closed) throw new RemoteFailure('offline');
		this.unbind();
		this.send = send;
		const { client } = this.options,
			input = { protocol: REMOTE_PROTOCOL, client, resume: this.cursor },
			id = this.id();
		this.attaching = id;
		const attachment = (await this.issue({
			type: 'request',
			id,
			method: attachMethod,
			input
		})) as RemoteAttachment;
		this.bound = true;
		for (const item of this.waiting.values()) send(JSON.stringify(item.request));
		return attachment;
	}
	/** The connection is gone. Requests in flight wait for the next one; nothing new is queued. */
	unbind(): void {
		this.send = null;
		this.bound = false;
		if (this.attaching) this.settle(this.attaching)?.reject(new RemoteFailure('offline'));
		this.attaching = null;
	}
	close(): void {
		this.closed = true;
		this.unbind();
		for (const id of [...this.waiting.keys()])
			this.settle(id)?.reject(new RemoteFailure('offline'));
	}
	request<T = unknown>(method: RemoteMethod, input: Record<string, unknown> = {}): Promise<T> {
		if (!this.bound || !this.cursor) return Promise.reject(new RemoteFailure('offline'));
		const change = mutationMethods.includes(method),
			body = change ? { ...input, epoch: this.cursor.epoch } : input;
		return this.issue({ type: 'request', id: this.id(), method, input: body }) as Promise<T>;
	}
	on(channel: WireChannel, listener: Listener): () => void {
		const set = this.listeners.get(channel) ?? new Set<Listener>();
		this.listeners.set(channel, set.add(listener));
		return () => set.delete(listener);
	}
	/** One text frame from the host. Anything that is not a response or an event is ignored. */
	receive(text: string): void {
		let message;
		try {
			message = this.messages.message(text);
		} catch {
			return;
		}
		if (message.type === 'event') return this.event(message);
		if (message.id === this.attaching && message.ok) this.adopt(message.value as RemoteAttachment);
		const waiting = this.settle(message.id);
		if (message.ok) waiting?.resolve(message.value);
		else waiting?.reject(new RemoteFailure(message.error.code, message.error.message));
	}
	/** Runs before any replayed event is read, so the cursor is right for what follows. */
	private adopt(attachment: RemoteAttachment): void {
		const { epoch, sequence, replay } = attachment,
			moved = this.cursor !== null && this.cursor.epoch !== epoch,
			lost = replay === 'gap' || moved;
		if (lost || !this.cursor) this.cursor = { epoch, sequence };
		this.attachment = attachment;
		this.attaching = null;
		if (moved) this.uncertain();
		if (lost) this.notify('connection', { kind: 'resync' });
	}
	/** A change issued under an earlier epoch is never sent again: it may have been made. */
	private uncertain(): void {
		for (const [id, waiting] of [...this.waiting])
			if (mutationMethods.includes(waiting.request.method))
				this.settle(id)?.reject(new RemoteFailure('request-expired'));
	}
	private event(event: WireEvent): void {
		if (!this.cursor || event.sequence <= this.cursor.sequence) return;
		this.cursor = { epoch: this.cursor.epoch, sequence: event.sequence };
		this.notify(event.channel, event.value);
	}
	private notify(channel: WireChannel, value: unknown): void {
		for (const listener of [...(this.listeners.get(channel) ?? [])]) listener(value);
	}
	private issue(request: WireRequest): Promise<unknown> {
		return new Promise((resolve, reject) => {
			const expire = () => this.settle(request.id)?.reject(new RemoteFailure('deadline'));
			const milliseconds = this.options.deadlineMs ?? remoteLimits.mutationDeadlineMs + 5000;
			const timer = setTimeout(expire, milliseconds);
			this.waiting.set(request.id, { request, resolve, reject, timer });
			this.send?.(JSON.stringify(request));
		});
	}
	private settle(id: string): Waiting | undefined {
		const waiting = this.waiting.get(id);
		if (waiting) clearTimeout(waiting.timer);
		this.waiting.delete(id);
		return waiting;
	}
	private id(): string {
		return this.options.uuid?.() ?? crypto.randomUUID();
	}
}
