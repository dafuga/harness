import { z } from 'zod';

/** Composition is independent from the responsibility category and stable unit identity. */
export const compositionSchema = z.strictObject({
	level: z.enum(['atom', 'molecule', 'organism', 'layout', 'page']),
	element: z.string().trim().min(1).optional(),
	/** Direct runtime component calls, excluding type imports and navigation links. */
	uses: z.array(z.string().trim().min(1)).optional()
});
