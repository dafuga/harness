import { hubFail } from "../../utils/hubJson";
import { hubPngChunks } from "./hubPngChunks";
import { type Header, type State } from "../../utils/hubPngChunks";

const LIMIT = 32 * 1024 * 1024;

const CHANNELS: Record<number, number> = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

function rows(h: Header) {
	const passes = h.interlace
		? [
				[0, 0, 8, 8],
				[4, 0, 8, 8],
				[0, 4, 4, 8],
				[2, 0, 4, 4],
				[0, 2, 2, 4],
				[1, 0, 2, 2],
				[0, 1, 1, 2]
			]
		: [[0, 0, 1, 1]];
	const result = passes
		.map(([x, y, dx, dy]) => {
			const width = Math.max(0, Math.ceil((h.width - x) / dx)),
				height = Math.max(0, Math.ceil((h.height - y) / dy));
			return {
				size: 1 + Math.ceil((width * CHANNELS[h.color] * h.depth) / 8),
				count: width ? height : 0
			};
		})
		.filter((row) => row.count > 0);
	if (result.reduce((sum, row) => sum + row.size * row.count, 0) > LIMIT) return hubFail();
	return result;
}

function compressedStream(data: Uint8Array[]): ReadableStream<BufferSource> {
	let index = 0,
		offset = 0;
	return new ReadableStream({
		pull(controller) {
			while (index < data.length && offset === data[index].length) {
				index++;
				offset = 0;
			}
			if (index === data.length) {
				controller.close();
				return;
			}
			const end = Math.min(data[index].length, offset + 1024);
			controller.enqueue(new Uint8Array(data[index].subarray(offset, end)));
			offset = end;
		}
	});
}

async function scanlines(state: State): Promise<void> {
	const layout = rows(state.header);
	const reader = compressedStream(state.data)
		.pipeThrough(new DecompressionStream('deflate'))
		.getReader();
	let pass = 0,
		row = 0,
		position = 0;
	try {
		for (;;) {
			const { done, value } = await reader.read();
			if (done) break;
			let offset = 0;
			while (offset < value.length) {
				const current = layout[pass];
				if (!current) return hubFail();
				if (position === 0 && value[offset] > 4) return hubFail();
				const take = Math.min(current.size - position, value.length - offset);
				offset += take;
				position += take;
				if (position === current.size) {
					position = 0;
					row++;
				}
				if (row === current.count) {
					pass++;
					row = 0;
				}
			}
		}
		if (pass !== layout.length) return hubFail();
	} finally {
		await reader.cancel();
	}
}

/** Validates chunk CRC/order, legal headers and bounded complete deflate scanlines. */
export async function hubPng(bytes: Uint8Array): Promise<{ width: number; height: number }> {
	try {
		const state = hubPngChunks(bytes);
		await scanlines(state);
		return { width: state.header.width, height: state.header.height };
	} catch {
		return hubFail();
	}
}
