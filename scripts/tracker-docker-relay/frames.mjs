// @harness-uid u_7cexw2zytg
import { runInThisContext } from 'node:vm';

// The same checked-in implementation runs in the host and the standalone Docker launcher.
// Only this constant is compiled. Frames and command inputs are data.
export const trackerRelayFramingSource = String.raw`(function trackerRelayFraming() {
	const { Buffer } = globalThis;
	const maxFrameBytes = 4096;

	function appendFrameBytes(prefix, suffix) {
		if (prefix.length + suffix.length > maxFrameBytes) {
			throw new RangeError('Tracker relay frame exceeds 4096 bytes');
		}
		return Buffer.concat([prefix, suffix]);
	}

	/** Bound incomplete frames as well as complete lines before parsing untrusted input. */
	async function* readFrames(input) {
		let pending = Buffer.alloc(0);
		for await (const chunk of input) {
			let start = 0;
			for (let end = chunk.indexOf(10); end !== -1; end = chunk.indexOf(10, start)) {
				yield appendFrameBytes(pending, chunk.subarray(start, end)).toString('utf8');
				pending = Buffer.alloc(0);
				start = end + 1;
			}
			pending = appendFrameBytes(pending, chunk.subarray(start));
		}
		if (pending.length) throw new SyntaxError('Incomplete Tracker relay frame');
	}

	function writeFrame(output, frame) {
		if (Buffer.byteLength(frame) > maxFrameBytes || frame.includes('\n')) {
			return Promise.reject(new RangeError('Invalid outbound Tracker relay frame'));
		}
		return new Promise((resolve, reject) => {
			output.write(frame + '\n', (error) => (error ? reject(error) : resolve()));
		});
	}

	const maxRelayPayloadBytes = 128 * 1024;

	/** Transfer a bounded payload without changing the per-frame bound. */
	async function writeFramePayload(output, text) {
		const bytes = Buffer.from(text);
		if (bytes.length > maxRelayPayloadBytes)
			throw new RangeError('Tracker relay payload too large');
		const chunkBytes = (maxFrameBytes / 4) * 3;
		for (let offset = 0; offset < bytes.length; offset += chunkBytes) {
			await writeFrame(output, bytes.subarray(offset, offset + chunkBytes).toString('base64'));
		}
		await writeFrame(output, '.');
	}

	async function readFramePayload(frames) {
		const chunks = [];
		let size = 0;
		for (;;) {
			const { value, done } = await frames.next();
			if (done) throw new SyntaxError('Incomplete Tracker relay payload');
			if (value === '.') return Buffer.concat(chunks, size).toString('utf8');
			const bytes = Buffer.from(value, 'base64');
			if (!bytes.length || bytes.toString('base64') !== value)
				throw new SyntaxError('Invalid Tracker relay payload frame');
			size += bytes.length;
			if (size > maxRelayPayloadBytes) throw new RangeError('Tracker relay payload too large');
			chunks.push(bytes);
		}
	}

	return { readFrames, writeFrame, readFramePayload, writeFramePayload, maxRelayPayloadBytes };
})()`;

export const { readFrames, writeFrame, readFramePayload, writeFramePayload, maxRelayPayloadBytes } =
	runInThisContext(trackerRelayFramingSource);
