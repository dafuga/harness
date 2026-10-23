import type { evidenceData } from './ui-evidence-data';

export type Mode = 'current' | 'commit';

export type EvidenceData = ReturnType<typeof evidenceData>;
