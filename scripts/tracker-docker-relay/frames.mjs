import { Buffer } from 'node:buffer';

const maxFrameBytes = 4096;

function appendFrameBytes(prefix, suffix) {
	if (prefix.length + suffix.length > maxFrameBytes) {
		throw new RangeError('Tracker relay frame exceeds 4096 bytes');
	}
	return Buffer.concat([prefix, suffix]);
}

/** Bound incomplete frames as well as complete lines before parsing untrusted input. */
export async function* readFrames(input) {
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
	if (pending.length) throw new Error('Incomplete Tracker relay frame');
}

export function writeFrame(output, frame) {
	return new Promise((resolve, reject) => {
		output.write(frame + '\n', (error) => (error ? reject(error) : resolve()));
	});
}
