// @harness-uid u_wwu3xgisul
import type { z } from 'zod';
import type { verifyConfigSchema, captureLineSchema, workloadSchema } from './verifyTypes';

type ParsedVerifyConfig = z.infer<typeof verifyConfigSchema>;

/**
 * A verify configuration. `profiles` is optional here, so a config object written before
 * profiles existed still satisfies the type; parsing always fills it (default `{}`) and
 * expands each check's profile into the check, so readers never need the map.
 */
export type VerifyConfig = Omit<ParsedVerifyConfig, 'profiles'> &
	Partial<Pick<ParsedVerifyConfig, 'profiles'>>;

export type CaptureLine = z.infer<typeof captureLineSchema>;

export type Workload = z.infer<typeof workloadSchema>;
