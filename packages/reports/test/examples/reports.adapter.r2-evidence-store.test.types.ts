import type { R2EvidenceStoreAdapter } from '../../src/adapters/reports-media/R2EvidenceStoreAdapter';

export type Client = NonNullable<ConstructorParameters<typeof R2EvidenceStoreAdapter>[1]>;

export type Sent = { key: string; type: string | undefined };

export type FakeCommand = { input: { Key: string; Body?: Buffer; ContentType?: string } };
