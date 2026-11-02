// @harness-uid u_dluvqzqdcs
export type RepositoryLease = (() => Promise<void>) & { signal: AbortSignal };
