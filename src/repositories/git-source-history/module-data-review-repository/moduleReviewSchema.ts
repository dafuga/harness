import { z } from 'zod';
import { componentManifestSchema } from '../../../core/development-tooling/unitTypes';
/** Authored descriptions and contracts cannot replace source, dependencies, evidence or budgets. */
export const moduleReviewSchema = z.strictObject({
	commit: z
		.string()
		.regex(/^[a-f0-9]{40,64}$/)
		.optional(),
	unit: z.string().min(1),
	reason: z.string().trim().min(1),
	metadata: componentManifestSchema
		.pick({
			responsibility: true,
			contract: true,
			helperContracts: true,
			configControls: true,
			preview: true,
			runtime: true
		})
		.partial()
		.refine((metadata) => Object.keys(metadata).length > 0)
});
export const moduleReviewDocument = z.union([
	moduleReviewSchema,
	z.array(moduleReviewSchema).min(1)
]);
