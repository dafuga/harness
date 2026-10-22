import { format } from 'node:util';

/**
 * Sends `console.log` through `process.stdout`. Once that stream has been used, the runtime
 * stops a direct console write at the pipe buffer, so JSON over 64 KiB reached a piped reader
 * cut short; the stream queues what does not fit and flushes it before the process exits.
 */
export function pipedOutput(): void {
	console.log = (...values: unknown[]): void => {
		process.stdout.write(`${format(...values)}\n`);
	};
}
