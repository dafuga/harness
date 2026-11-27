import type { hubCache } from '../../src/routes/api/[...path]/hubCache';

export type Entry = Parameters<ReturnType<typeof hubCache>['put']>[1];

export type StoredObject = { bytes: Uint8Array; customMetadata: Record<string, string> };
