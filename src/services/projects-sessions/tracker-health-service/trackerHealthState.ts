// @harness-uid u_6ll3be262q
import { readFileSync, renameSync, writeFileSync } from 'node:fs';
import { z } from 'zod';
import type { TrackerHealthState } from './trackerHealthState.types';

const schema = z.object({
	item_id: z.string().optional(),
	item_open: z.boolean().optional(),
	webhook_failed: z.number().optional(),
	checks: z
		.record(
			z.string(),
			z.object({
				ok: z.boolean(),
				last_alert: z.number().optional(),
				last_fallback: z.number().optional()
			})
		)
		.default({})
});

/** A missing or damaged state file only means the next failure alerts again. */
export function readTrackerHealthState(path: string): TrackerHealthState {
	try {
		return schema.parse(JSON.parse(readFileSync(path, 'utf8')));
	} catch {
		return { checks: {} };
	}
}

export function writeTrackerHealthState(path: string, state: TrackerHealthState): void {
	const staged = `${path}.${process.pid}.tmp`;
	writeFileSync(staged, JSON.stringify(state), { mode: 0o600 });
	renameSync(staged, path);
}
