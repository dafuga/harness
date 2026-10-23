import type { Measurement } from '../../core/verification-evidence/verificationTypes';

/** Size and hash of each declared artifact that exists, by path. */
export type BuiltArtifacts = Record<string, { bytes: number; sha256: string }>;

export interface Static {
	metric: string;
	unitOfMeasure: string;
	value: number | null;
	method: string;
	/** Why there is no value at all. */
	unavailable?: string;
	/** What a value leaves out, when only part of the unit could be measured. */
	partial?: string;
}

export type ArtifactEntry = Pick<
	Measurement,
	'metric' | 'unitOfMeasure' | 'value' | 'unavailable' | 'method' | 'target' | 'artifacts'
>;
