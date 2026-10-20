import type { Header, State } from '../../../../utils/hubPngChunks';
import { hubFail } from '../../../../utils/hubJson';

const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

const LIMIT = 32 * 1024 * 1024;

const DEPTHS: Record<number, number[]> = {
	0: [1, 2, 4, 8, 16],
	2: [8, 16],
	3: [1, 2, 4, 8],
	4: [8, 16],
	6: [8, 16]
};

const CRC = Uint32Array.from({ length: 256 }, (_, index) => {
	let value = index;
	for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ (value & 1 ? 0xedb88320 : 0);
	return value >>> 0;
});

function crc(bytes: Uint8Array): number {
	let value = 0xffffffff;
	for (const byte of bytes) value = CRC[(value ^ byte) & 255] ^ (value >>> 8);
	return (value ^ 0xffffffff) >>> 0;
}

function header(bytes: Uint8Array): Header {
	if (bytes.length !== 13) return hubFail();
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.length);
	const result = {
		width: view.getUint32(0),
		height: view.getUint32(4),
		depth: bytes[8],
		color: bytes[9],
		interlace: bytes[12]
	};
	if (!result.width || !result.height || result.width * result.height > 32000000) return hubFail();
	if (
		!DEPTHS[result.color]?.includes(result.depth) ||
		bytes[10] !== 0 ||
		bytes[11] !== 0 ||
		bytes[12] > 1
	)
		return hubFail();
	return result;
}

function palette(state: State, bytes: Uint8Array) {
	if (state.started || state.transparency || state.palette || [0, 4].includes(state.header.color))
		return hubFail();
	if (!bytes.length || bytes.length % 3 || bytes.length > 768) return hubFail();
	state.palette = bytes.length / 3;
	if (state.header.color === 3 && state.palette > 2 ** state.header.depth) return hubFail();
}

function transparency(state: State, bytes: Uint8Array) {
	if (state.started || state.transparency) return hubFail();
	const color = state.header.color;
	const valid =
		color === 3
			? state.palette > 0 && bytes.length > 0 && bytes.length <= state.palette
			: bytes.length === ({ 0: 2, 2: 6 } as Record<number, number>)[color];
	if (!valid) return hubFail();
	state.transparency = true;
}

function consume(state: State, type: string, bytes: Uint8Array) {
	if (type === 'IDAT') return imageData(state, bytes);
	if (state.started) state.closed = true;
	if (type === 'PLTE') return palette(state, bytes);
	if (type === 'tRNS') return transparency(state, bytes);
	if (type === 'IEND') {
		if (bytes.length || !state.started) return hubFail();
		state.end = true;
		return;
	}
	if (type[0] === type[0].toUpperCase()) return hubFail();
}

export function hubPngChunks(bytes: Uint8Array): State {
	checkSignature(bytes);
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.length);
	let state: State | undefined,
		offset = 8,
		count = 0;
	while (offset < bytes.length) {
		if (++count > 10000 || offset + 12 > bytes.length || state?.end) return hubFail();
		const { type, data, end } = readChunk(bytes, view, offset);
		if (!state) {
			if (type !== 'IHDR') return hubFail();
			state = {
				header: header(data),
				data: [],
				palette: 0,
				transparency: false,
				started: false,
				closed: false,
				end: false
			};
		} else consume(state, type, data);
		offset = end;
	}
	if (!state?.end) return hubFail();
	return state;
}

function imageData(state: State, bytes: Uint8Array) {
	if (state.closed || (state.header.color === 3 && !state.palette)) return hubFail();
	state.started = true;
	state.data.push(bytes);
}

function readChunk(bytes: Uint8Array, view: DataView, offset: number) {
	const end = offset + 12 + view.getUint32(offset);
	if (end > bytes.length) return hubFail();
	const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
	if (!/^[A-Za-z]{2}[A-Z][A-Za-z]$/.test(type)) return hubFail();
	if (crc(bytes.subarray(offset + 4, end - 4)) !== view.getUint32(end - 4)) return hubFail();
	return { type, end, data: bytes.subarray(offset + 8, end - 4) };
}

function checkSignature(bytes: Uint8Array) {
	if (bytes.length < 45 || bytes.length > LIMIT || SIGNATURE.some((value, i) => bytes[i] !== value))
		return hubFail();
}
