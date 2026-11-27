// @harness-uid u_qavdfa3unc
import { randomBytes } from 'node:crypto';
import type { Duplex } from 'node:stream';
import type { PipeWebSocketHandlers } from './pipeWebSocket.types';

const maxMessage = 16 * 1024 * 1024;
const fragments = new WeakMap<Duplex, Buffer[]>();

/** Client frames are always masked. */
export function clientFrame(opcode: number, payload: Buffer): Buffer {
	const length = payload.length;
	let extra = 0;
	let marker = length;
	if (length >= 65_536) [extra, marker] = [8, 127];
	else if (length >= 126) [extra, marker] = [2, 126];
	const head = Buffer.alloc(2 + extra);
	head[0] = 0x80 | opcode;
	head[1] = 0x80 | marker;
	if (extra === 2) head.writeUInt16BE(length, 2);
	if (extra === 8) head.writeBigUInt64BE(BigInt(length), 2);
	const mask = randomBytes(4);
	const masked = Buffer.from(payload);
	for (let index = 0; index < masked.length; index++) masked[index] ^= mask[index % 4];
	return Buffer.concat([head, mask, masked]);
}

/** Handles every complete server frame and returns the unread remainder. */
export function readFrames(
	buffer: Buffer,
	stream: Duplex,
	handlers: PipeWebSocketHandlers,
	closed: () => void
): Buffer {
	let rest = buffer;
	for (let frame = nextFrame(rest); frame; frame = nextFrame(rest)) {
		rest = rest.subarray(frame.size);
		if (frame.opcode === 8 || frame.size > maxMessage) {
			closed();
			return Buffer.alloc(0);
		}
		if (frame.opcode === 9) stream.write(clientFrame(10, frame.payload));
		if (frame.opcode > 2) continue;
		const parts = [...(fragments.get(stream) ?? []), frame.payload];
		if (!frame.final) fragments.set(stream, parts);
		else {
			fragments.delete(stream);
			handlers.message(Buffer.concat(parts).toString());
		}
	}
	if (rest.length > maxMessage) closed();
	return rest;
}

function nextFrame(buffer: Buffer) {
	if (buffer.length < 2) return undefined;
	let length = buffer[1] & 0x7f;
	let offset = 2;
	if (length === 126) {
		if (buffer.length < 4) return undefined;
		length = buffer.readUInt16BE(2);
		offset = 4;
	} else if (length === 127) {
		if (buffer.length < 10) return undefined;
		length = Number(buffer.readBigUInt64BE(2));
		offset = 10;
	}
	const size = offset + length;
	// An oversized frame is reported at once instead of being buffered to its end.
	if (size > maxMessage) return { size, opcode: 8, final: true, payload: Buffer.alloc(0) };
	if (buffer.length < size) return undefined;
	const payload = buffer.subarray(offset, size);
	return { size, opcode: buffer[0] & 0x0f, final: (buffer[0] & 0x80) !== 0, payload };
}
