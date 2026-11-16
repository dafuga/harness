// @harness-uid u_34r2rrehaa
import { basename } from 'node:path';
import { CommandTimeoutError } from './commandFailure.types';

/** A rejected command carrying only the already-buffered, bounded output prefix. */
export class BoundedCommandFailure extends Error {
	declare readonly stdout: Buffer;
	declare readonly stderr: string;
	constructor(message: string, stdout: Buffer, stderr: string) {
		super(message);
		this.name = 'BoundedCommandFailure';
		// Not enumerable: an uncaught failure prints its message, not up to maxBuffer bytes of
		// captured output (a 480 MB evidence read once dumped 156 MB into the terminal).
		Object.defineProperty(this, 'stdout', { value: stdout, enumerable: false });
		Object.defineProperty(this, 'stderr', { value: stderr, enumerable: false });
	}
}

/** Avoid echoing argument values, which may contain credentials or private paths. */
export function commandLabel(command: string): string {
	return basename(command);
}

function span(ms: number): string {
	return ms < 60000 ? `${ms} ms` : `${ms} ms (${Math.round(ms / 60000)} min)`;
}

/** A deadline failure that names the command and the deadline it exceeded. */
export function timeoutFailure(label: string, timeoutMs: number): Error {
	return new CommandTimeoutError(`Command timed out after ${span(timeoutMs)}: ${label}`);
}
