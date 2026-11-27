// @harness-uid u_btbtphcoba
import { z } from 'zod';
import { trackerHostWork } from '../../../utils/projects-sessions/trackerHostWork';
import { trackerResourceSample } from '../../../repositories/projects-sessions/tracker-machine-repository/trackerResourceSample';

export const trackerRunnerSample = z.object({
	enabled: z.boolean().nullish(),
	last_tick_at: z.string().nullish(),
	last_error: z.string().nullish(),
	waiting_on: z.string().nullish(),
	active: z.int().nonnegative().nullish(),
	automatic_enabled: z.boolean().optional(),
	capacity: z
		.object({
			freeSlots: z.int().min(0).max(500),
			projects: z.record(
				z.string(),
				z.object({ freeGB: z.number().nonnegative(), freePct: z.number().min(0).max(100) })
			)
		})
		.nullish(),
	waiting: z.record(z.string(), z.string()).optional(),
	waiting_tokens: z.record(z.string(), z.string()).optional()
});

export const trackerMachineSample = z.object({
	node: z.string().min(1).max(128),
	at: z.iso.datetime(),
	runner: trackerRunnerSample,
	host_work: trackerHostWork.report.optional().catch(undefined),
	// A malformed resource reading must not drop the launcher report beside it.
	resources: trackerResourceSample.optional().catch(undefined)
});
