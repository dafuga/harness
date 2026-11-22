// @harness-uid u_xadic2nwwc
import type { VaultCdpMessage, VaultCdpPipeStreams } from './VaultCdpPipe.types';

export const maxCdpFrameBytes = 16 * 1024 * 1024;
const maxPending = 512;

/** Chromium's pipe terminates each UTF-8 CDP message with a NUL byte. */
export class VaultCdpPipe {
	private readonly pending = new Map<number, number>();
	private nextId = 0;
	private parts: Buffer[] = [];
	private size = 0;

	constructor(private readonly streams: VaultCdpPipeStreams) {}

	send(text: string): boolean {
		const request = decode(text);
		if (request?.id === undefined || !Number.isSafeInteger(request.id) || !request.method) {
			return false;
		}
		if (this.pending.size >= maxPending || this.streams.writable.writableNeedDrain) return false;
		const id = ++this.nextId;
		this.pending.set(id, request.id);
		this.streams.writable.write(JSON.stringify({ ...request, id }) + '\0');
		return true;
	}

	receive(chunk: Buffer, emit: (text: string) => void): boolean {
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
	}

	private reply(message: VaultCdpMessage, emit: (text: string) => void): void {
		if (message.id === undefined) {
			if (typeof message.method === 'string') emit(JSON.stringify(message));
			return;
		}
		const id = this.pending.get(message.id);
		this.pending.delete(message.id);
		if (id !== undefined) emit(JSON.stringify({ ...message, id }));
	}
}

function decode(text: string): VaultCdpMessage | null {
	try {
		const parsed: unknown = JSON.parse(text);
		return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
	} catch {
		return null;
	}
}
