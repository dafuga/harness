// @harness-uid u_wwerrde2nk
import type { z } from 'zod';
import type {
	securityDecisionSchema,
	securityReviewSchema,
	securityScanSchema
} from './securityReviewSchemas';

export type SecurityScanReport = z.output<typeof securityScanSchema>;
export type SecurityReviewReport = z.output<typeof securityReviewSchema>;
export type SecurityDecision = z.output<typeof securityDecisionSchema>;
