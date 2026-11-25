import type { observe, sentOf } from './collaboration.function.github-lfs.test';

export type Reply = {
	status: number;
	json?: unknown;
	text?: string;
	headers?: Record<string, string>;
};

export type Observed = Awaited<ReturnType<typeof observe>>;

export type Sent = ReturnType<typeof sentOf>;
