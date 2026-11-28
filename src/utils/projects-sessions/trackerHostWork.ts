// @harness-uid u_opnwwyftd7
import { z } from 'zod';

/** Lease timing and wire contracts shared by the launcher, API and fleet sync. */
export const trackerHostWork = {
	leaseMs: 150_000,
	renewMs: 30_000,
	claim: z.strictObject({
		run: z.int().positive(),
		lease: z.uuid(),
		host: z.string().trim().min(1).max(128),
		kind: z.enum(['ssh', 'colima'])
	}),
	report: z
		.array(
			z.object({
				run: z.int().positive(),
				host: z.string().min(1).max(128),
				expires_at: z.int().positive()
			})
		)
		.max(1500)
};
