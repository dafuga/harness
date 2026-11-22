// @harness-uid u_xadic2nwwc
import { ExpectedCliError } from '../../../core/development-tooling/errors';
import type { VaultCdpMessage, VaultCdpPipeStreams, VaultCdpReader } from './VaultCdpPipe.types';

export const maxCdpFrameBytes = 16 * 1024 * 1024;
const maxPending = 512;

/** Chromium's pipe terminates each UTF-8 CDP message with a NUL byte. */
export class VaultCdpPipe {
	private readonly pending = new Map<number, number>();
	private readonly sessions = new Set<string>();
	private nextId = 0;
	private parts: Buffer[] = [];
	private size = 0;
	private reader?: VaultCdpReader;
	private ended = false;

	constructor(private readonly streams: VaultCdpPipeStreams) {
		streams.readable.on('data', (chunk: Buffer) => {
			if (!this.receive(chunk, (text) => this.reader?.message(text))) this.end();
		});
		streams.readable.once('end', this.end).on('error', this.end);
		streams.writable.on('error', this.end);
	}

	/** A private recipe or a lease relay holds the pipe exclusively. */
	listen(reader: VaultCdpReader): () => void {
		if (this.reader || this.ended) throw new ExpectedCliError('The Vault CDP pipe is unavailable.');
		this.reader = reader;
		return () => {
			if (this.reader !== reader) return;
			this.reader = undefined;
			this.detach();
		};
	}

	send(text: string): boolean {
		if (!this.reader || this.ended) return false;
		const request = decode(text);
		if (
			request?.id === undefined ||
			!Number.isSafeInteger(request.id) ||
			typeof request.method !== 'string'
		) {
			return false;
		}
		if (this.pending.size >= maxPending || this.streams.writable.writableNeedDrain) return false;
		const id = ++this.nextId;
		this.pending.set(id, request.id);
		this.streams.writable.write(JSON.stringify({ ...request, id }) + '\0');
		return true;
	}

	private receive(chunk: Buffer, emit: (text: string) => void): boolean {
		let offset = 0;
		while (offset < chunk.length) {
			const stop = chunk.indexOf(0, offset);
			const part = chunk.subarray(offset, stop < 0 ? chunk.length : stop);
			this.size += part.length;
			if (this.size > maxCdpFrameBytes) return false;
			if (part.length) this.parts.push(part);
			if (stop < 0) return true;
			const message = decode(Buffer.concat(this.parts, this.size).toString('utf8'));
			this.parts = [];
			this.size = 0;
			if (!message) return false;
			this.reply(message, emit);
			offset = stop + 1;
		}
		return true;
	}

	detach(): void {
		this.pending.clear();
		this.sessions.clear();
	}

	private reply(message: VaultCdpMessage, emit: (text: string) => void): void {
		if (!this.reader) return;
		if (message.id === undefined) {
			this.event(message, emit);
			return;
		}
		const id = this.pending.get(message.id);
		this.pending.delete(message.id);
		if (id === undefined) return;
		if (typeof message.result?.sessionId === 'string') this.sessions.add(message.result.sessionId);
		emit(JSON.stringify({ ...message, id }));
	}

	private event(message: VaultCdpMessage, emit: (text: string) => void): void {
		if (message.sessionId && !this.sessions.has(message.sessionId)) return;
		const id = message.params?.sessionId;
		if (typeof id === 'string') {
			if (message.method === 'Target.attachedToTarget') this.sessions.add(id);
			if (message.method === 'Target.detachedFromTarget') this.sessions.delete(id);
		}
		if (typeof message.method === 'string') emit(JSON.stringify(message));
	}

	private readonly end = (): void => {
		if (this.ended) return;
		this.ended = true;
		this.reader?.close();
		this.detach();
	};
}

function decode(text: string): VaultCdpMessage | null {
	try {
		const parsed: unknown = JSON.parse(text);
		return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
	} catch {
		return null;
	}
}
