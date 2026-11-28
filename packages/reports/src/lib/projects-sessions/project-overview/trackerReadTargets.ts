// @harness-uid u_jbitb4ddsm
import { z } from 'zod';
const TRACKER_ORIGIN = 'http://127.0.0.1:7701';
export const TRACKER_TIMEOUT_MS = 1500;

/** The only tracker reads the overview may issue. Each is a fixed GET path on the local API. */
export const TRACKER_GET_URLS = {
	items: `${TRACKER_ORIGIN}/items?status=all&limit=-1`,
	homeRuns: `${TRACKER_ORIGIN}/runs?limit=500&include_active=1`,
	runs: `${TRACKER_ORIGIN}/runs?limit=500`,
	machines: `${TRACKER_ORIGIN}/machines`,
	status: `${TRACKER_ORIGIN}/status`,
	sessionRules: `${TRACKER_ORIGIN}/rules?limit=5`
} as const;

export const ITEM_STATUSES: ReadonlySet<string> = new Set([
	'open',
	'in_progress',
	'blocked',
	'done',
	'ignored'
]);
export const MACHINE_STATUSES: ReadonlySet<string> = new Set([
	'ok',
	'busy',
	'overloaded',
	'offline'
]);

const percent = z.number().int().min(0).max(100);
export const trackerUtilizationSchema = z.strictObject({
	actual: z.strictObject({ cpu: percent.nullable(), ram: percent }),
	target: z.strictObject({ cpu: percent, ram: percent })
});
