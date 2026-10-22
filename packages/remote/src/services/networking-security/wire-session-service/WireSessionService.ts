import {
	REMOTE_PROTOCOL,
	RemoteFailure,
	attachMethod,
	remoteErrorMessages,
	remoteLimits
} from '../../../models/networking-security/Remote.types';
import type {
	RemoteAttachment,
	RemoteError,
	RemoteLimits,
	RemoteMethod,
	WireChannel,
	WireMessage,
	WireRequest
} from '../../../models/networking-security/Remote.types';
import { wireDispatch } from './wireDispatch';
import { RemoteInputValidator } from '../../../validators/networking-security/RemoteInputValidator';
import { WireMessageValidator } from '../../../validators/networking-security/WireMessageValidator';
import { EventLogService } from './EventLogService';
import { ResponseLedgerService } from './ResponseLedgerService';

export interface WireSessionOptions {
	role: RemoteAttachment['role'];
	/** What this client may call right now; read again for every request. */
	methods: () => readonly RemoteMethod[];
	describe: () => Pick<RemoteAttachment, 'host' | 'device' | 'grant'>;
	/** Policy and operation of one allowed request. Throw `RemoteFailure` to refuse with a code. */
	handle: (request: WireRequest) => Promise<unknown>;
	/** Turns any other error into public words. By default nothing of the error is shown. */
	explain?: (error: unknown) => RemoteError;
	limits?: Partial<RemoteLimits>;
	epoch?: string;
	/** Mutations must name this session's epoch: one issued before a restart is never run. */
	authority?: boolean;
}

/** One connection of a session. A transport feeds it text frames and closes it when it ends. */
export interface WireLink {
	receive(text: string): Promise<void>;
	close(): void;
}

interface Sink {
	send: (text: string) => void;
	violation: () => void;
	attached: boolean;
	open: boolean;
	pending: number;
}

const unexplained = (): RemoteError => ({ code: 'failed', message: remoteErrorMessages.failed });

/**
 * The host side of one client: it outlives connections. Events, remembered answers and the
 * allowed methods belong to the client, so a reconnect resumes and never repeats a mutation.
 */
export class WireSessionService {
	readonly events: EventLogService;
	private readonly limits: RemoteLimits;
	private readonly ledger: ResponseLedgerService;
	private readonly messages = new WireMessageValidator();
	private readonly inputs = new RemoteInputValidator();
	private current: Sink | null = null;
	private over = false;
	constructor(private readonly options: WireSessionOptions) {
		this.limits = { ...remoteLimits, ...options.limits };
		this.events = new EventLogService({ epoch: options.epoch, capacity: this.limits.eventLog });
		const { ledgerEntries: capacity, ledgerTtlMs: ttlMs } = this.limits;
		this.ledger = new ResponseLedgerService({ capacity, ttlMs });
	}
	get ended(): boolean {
		return this.over;
	}
	/** `violation` is called for a frame that cannot be answered; the transport should close. */
	connect(send: (text: string) => void, violation: () => void = () => undefined): WireLink {
		const sink: Sink = { send, violation, attached: false, open: true, pending: 0 };
		return { receive: (text) => this.receive(sink, text), close: () => this.release(sink) };
	}
	/** Recorded for replay, and sent now when a connection is attached. */
	emit(channel: WireChannel, value: unknown): void {
		if (!this.over) this.deliver(this.current, this.events.append(channel, value));
	}
	/** Revocation or shutdown: late answers and events are dropped, nothing more is accepted. */
	end(): void {
		this.over = true;
		if (this.current) this.release(this.current);
	}
	private release(sink: Sink): void {
		sink.open = false;
		if (this.current === sink) this.current = null;
	}
	private deliver(sink: Sink | null, message: WireMessage): void {
		if (sink?.open && !this.over) sink.send(JSON.stringify(message));
	}
	private async receive(sink: Sink, text: string): Promise<void> {
		if (this.over || !sink.open) return;
		let request: WireRequest;
		try {
			request = this.messages.request(text, this.limits.requestBytes);
		} catch (error) {
			return this.refuse(sink, error);
		}
		if (request.method === attachMethod) return this.attach(sink, request);
		const context = {
			attached: sink.attached,
			methods: this.options.methods(),
			pending: sink.pending++,
			limits: this.limits,
			ledger: this.ledger,
			handle: this.options.handle,
			epoch: this.events.epoch,
			bound: this.options.authority === true,
			explain: this.options.explain ?? unexplained
		};
		try {
			this.deliver(sink, await wireDispatch(context, request));
		} finally {
			sink.pending--;
		}
	}
	private refuse(sink: Sink, error: unknown): void {
		const failure = error instanceof RemoteFailure ? error : new RemoteFailure('invalid-message');
		if (!failure.requestId) return sink.violation();
		const { code, message } = failure;
		this.deliver(sink, {
			type: 'response',
			id: failure.requestId,
			ok: false,
			error: { code, message }
		});
	}
	/** The newest attached connection becomes the one that receives events. */
	private attach(sink: Sink, request: WireRequest): void {
		let resume;
		try {
			resume = this.inputs.attach(request.input).resume;
		} catch (error) {
			(error as RemoteFailure).requestId = request.id;
			return this.refuse(sink, error);
		}
		const { replay, events } = this.events.since(resume);
		if (this.current && this.current !== sink) this.current.open = false;
		this.current = sink;
		sink.attached = true;
		const value: RemoteAttachment = {
			protocol: REMOTE_PROTOCOL,
			role: this.options.role,
			epoch: this.events.epoch,
			sequence: this.events.sequence,
			replay,
			...this.options.describe(),
			methods: [...this.options.methods()],
			limits: this.limits
		};
		this.deliver(sink, { type: 'response', id: request.id, ok: true, value });
		for (const event of events) this.deliver(sink, event);
	}
}
