// @harness-uid u_34r2rrehaa
import { basename } from 'node:path';

/** A rejected command carrying only the already-buffered, bounded output prefix. */
export class BoundedCommandFailure extends Error {
	constructor(
		message: string,
		readonly stdout: Buffer,
		readonly stderr: string
	) {
		super(message);
		this.name = 'BoundedCommandFailure';
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
	return new Error(`Command timed out after ${span(timeoutMs)}: ${label}`);
}
