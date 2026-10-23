import type { HarnessRecord } from '../../../reports/src/models/Harness.types';
import type { HarnessRevision } from '../../../reports/src/models/Harness.types';

export type Result = HarnessRecord['scenarios'][number];

export interface Example {
	input: unknown;
	output: unknown;
}

export interface SealedHistory {
	revisions: Record<string, HarnessRevision>;
	/** Every kept artifact by the SHA-256 its capture states. */
	bytes: Record<string, { mediaType: string; data: number[] }>;
}
