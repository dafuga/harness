import type { impactSeeds } from '../../src/services/reports-media/impact-service/impactSeeds';

export type Changes = Parameters<typeof impactSeeds>[0];

export type Manifest = { id: string; status: string; owns: { source: string[] } };
