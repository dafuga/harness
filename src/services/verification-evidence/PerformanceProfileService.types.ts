import type { z } from 'zod';
import type { reportedMeasurementSchema } from '../../core/verification-evidence/verifyTypes';
import type { observationInput, profileInput } from './PerformanceProfileService';

export type ProfileInput = z.input<typeof profileInput>;

export type ObservationInput = z.input<typeof observationInput>;

export type Measured = z.infer<typeof reportedMeasurementSchema>;

export interface Observation {
	input: ObservationInput;
	completion: 'return' | 'await' | 'scope';
	elapsed: number;
	samples: number;
	peakRss: number;
}
