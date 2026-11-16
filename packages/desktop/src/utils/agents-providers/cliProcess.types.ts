// @harness-uid u_b7hlwurone
import type { ResourceContext } from '../../../../../src/core/execution-runtimes/resourceTypes';

export class CliRequestTimeoutError extends Error {
	override name = 'CliRequestTimeoutError';
}

export class CliOutputLimitError extends Error {
	override name = 'CliOutputLimitError';
}

export class CliCommandFailedError extends Error {
	override name = 'CliCommandFailedError';
}

export interface ProcessOptions {
	resources?: ResourceContext;
	cwd?: string;
	input?: string;
	signal?: AbortSignal;
	onLine?: (line: string) => void;
	timeoutMs?: number;
	maxBytes?: number;
}
