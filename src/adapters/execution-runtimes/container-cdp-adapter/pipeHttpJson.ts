// @harness-uid u_wwxrcb3ahx
import type { Duplex } from 'node:stream';
import { ExpectedCliError } from '../../../core/development-tooling/errors';

/** One bounded HTTP GET of a DevTools JSON document over a private stream. */
export function pipeHttpJson(stream: Duplex, path: string, timeoutMs = 10_000): Promise<unknown> {
	return new Promise((resolve, reject) => {
		let buffer: Buffer = Buffer.alloc(0);
		const finish = (settle: () => void) => {
			clearTimeout(timer);
			stream.destroy();
			settle();
		};
		const failed = () =>
			finish(() => reject(new ExpectedCliError('The container browser did not answer.')));
		const timer = setTimeout(failed, timeoutMs);
		stream.on('data', (chunk: Buffer) => {
			buffer = Buffer.concat([buffer, chunk]);
			const end = buffer.indexOf('\r\n\r\n');
			if (end < 0) {
				if (buffer.length > 1024 * 1024) failed();
				return;
			}
			const length = /content-length:\s*(\d+)/iu.exec(buffer.subarray(0, end).toString());
			if (!length) {
				failed();
				return;
			}
			const body = buffer.subarray(end + 4);
			if (body.length < Number(length[1])) return;
			try {
				const parsed: unknown = JSON.parse(body.subarray(0, Number(length[1])).toString());
				finish(() => resolve(parsed));
			} catch {
				failed();
			}
		});
		stream.once('error', failed);
		stream.once('end', failed);
		stream.write(`GET ${path} HTTP/1.1\r\nHost: 127.0.0.1:9222\r\n\r\n`);
	});
}
