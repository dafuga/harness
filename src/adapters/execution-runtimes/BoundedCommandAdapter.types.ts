// @harness-uid u_34r2rrehaa
/* eslint-disable max-classes-per-file -- This companion holds the adapter's named error types. */
import type { ChildProcess } from 'node:child_process';

export class CommandAbortedError extends Error {
	override name = 'CommandAbortedError';
}

export class CommandBoundsError extends Error {
	override name = 'CommandBoundsError';
}

export class CommandOutputLimitError extends Error {
	override name = 'CommandOutputLimitError';
}

export class DirectProbeRestrictionError extends Error {
	override name = 'DirectProbeRestrictionError';
}

export interface BoundedCommandOptions {
	cwd?: string;
	env?: Record<string, string | undefined>;
	input?: string | Buffer;
	timeoutMs?: number;
	maxBuffer?: number;
	signal?: AbortSignal;
	onSpawn?: (child: ChildProcess) => void;
}
export interface BoundedCommandResult {
	code: number;
	stdout: Buffer;
	stderr: string;
}
