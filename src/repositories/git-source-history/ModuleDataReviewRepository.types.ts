import type { z } from 'zod';
import type { moduleReviewSchema } from './module-data-review-repository/moduleReviewSchema';
export type ModuleReviewInput = z.infer<typeof moduleReviewSchema>;
export interface ModuleReview extends ModuleReviewInput {
	schemaVersion: 1;
	commit: string;
	tree: string;
	files: Record<string, string>;
	digest: string;
}
