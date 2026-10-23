export type RepositoryLease = (() => Promise<void>) & { signal: AbortSignal };
