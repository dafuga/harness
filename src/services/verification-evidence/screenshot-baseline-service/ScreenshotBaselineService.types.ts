import type { z } from 'zod';
import type {
	screenshotBaselineRequestSchema,
	screenshotReviewBodySchema,
	screenshotReviewInputSchema,
	screenshotReviewSchema
} from './baselineSchemas';
import type {
	Capture,
	VerificationRecord
} from '../../../core/verification-evidence/verificationTypes';

export type ScreenshotReviewInput = z.infer<typeof screenshotReviewInputSchema>;
export type ScreenshotReviewBody = z.infer<typeof screenshotReviewBodySchema>;
export type ScreenshotReview = z.infer<typeof screenshotReviewSchema>;
export type ScreenshotBaselineRequest = z.infer<typeof screenshotBaselineRequestSchema>;
export type ScreenshotBaseline = { review: ScreenshotReview; bytes: Buffer };

export interface ScreenshotContract {
	state: string;
	file: string;
	testFile: string;
	testTitle: string;
	build: string;
	checks: string[];
	viewport: { width: number; height: number; scale: number };
	mode: 'viewport' | 'full-page' | 'element';
}

export interface ScreenshotCandidate {
	record: VerificationRecord;
	capture: Capture;
	caseStatus: 'passed' | 'failed';
	contract: ScreenshotContract;
	bytes: Buffer;
}
