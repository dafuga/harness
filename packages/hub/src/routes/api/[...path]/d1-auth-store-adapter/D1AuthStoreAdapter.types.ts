// @harness-uid u_qym3at4l2e
/** The part of Cloudflare's D1Database this adapter uses; a D1Database satisfies it. */
export interface D1Statement {
	bind(...values: unknown[]): D1Statement;
	first<T = unknown>(): Promise<T | null>;
	all<T = unknown>(): Promise<{ results: T[] }>;
	run(): Promise<unknown>;
}

export interface D1Like {
	prepare(query: string): D1Statement;
}
