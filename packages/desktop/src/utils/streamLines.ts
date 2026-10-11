/** Decode bounded newline-delimited messages while retaining an incomplete final line. */
export function streamLines(options: {
	onLine: (line: string) => void;
	maxBytes: number;
	onOverflow: () => void;
}) {
	let buffer = '';
	const decoder = new StringDecoder('utf8');
	const write = (chunk: Buffer) => {
		buffer += decoder.write(chunk);
		if (Buffer.byteLength(buffer) > options.maxBytes) {
			options.onOverflow();
			buffer = '';
			return;
		}
		const lines = buffer.split('\n');
		buffer = lines.pop() ?? '';
		lines.forEach((line) => options.onLine(line));
	};
	const end = () => {
		buffer += decoder.end();
		if (buffer) options.onLine(buffer);
		buffer = '';
	};
	return { write, end };
}
import { StringDecoder } from 'node:string_decoder';
