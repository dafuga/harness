import { z } from 'zod';

const minutes = z.int().positive().max(10_080).optional();

/** Per-host overrides; unset values keep the dispatcher's 1 retry, 120, 45 and 480 minutes. */
export const trackerRunLimits = {
	maxRetries: z.int().min(0).max(10).optional(),
	defaultEtaMinutes: minutes,
	stallMinutes: minutes,
	maxRunMinutes: minutes
};
