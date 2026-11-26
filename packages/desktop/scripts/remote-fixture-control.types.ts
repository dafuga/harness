// @harness-uid u_nmxl4zx5tk
export { RemoteFixtureRequestTooLargeError } from './RemoteFixtureRequestTooLargeError';

/** One control operation: `METHOD /path` → what it answers. */
export type FixtureAction = (body: Record<string, unknown>) => unknown;
