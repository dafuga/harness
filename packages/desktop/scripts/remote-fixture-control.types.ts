// @harness-uid u_nmxl4zx5tk
export class RemoteFixtureRequestTooLargeError extends Error {
	override name = 'RemoteFixtureRequestTooLargeError';
}

/** One control operation: `METHOD /path` → what it answers. */
export type FixtureAction = (body: Record<string, unknown>) => unknown;
