// @harness-uid u_bl6xl2h4a3
import { z } from 'zod';

export const watchdogScan = z
	.array(
		z.strictObject({
			name: z.string().regex(/^auto-[a-z0-9]{6,10}(?:-r[0-9]+)?$/),
			key: z.string().min(1).max(200),
			activity: z.int().nonnegative(),
			createdAt: z.int().nonnegative(),
			live: z.boolean(),
			runnerSocket: z.boolean(),
			readable: z.boolean(),
			ready: z.boolean(),
			attached: z.boolean(),
			currentCommand: z.string().max(80).optional(),
			x: z.int().nonnegative(),
			y: z.int().nonnegative(),
			screen: z.string().max(64_000).nullable(),
			cwd: z.string().max(4096).optional()
		})
	)
	.max(100)
	.refine((panes) => new Set(panes.map(({ key }) => key)).size === panes.length)
	.nullable();

export const watchdogEffectReceipt = z.strictObject({ sent: z.boolean() });

export const trackerWatchdogAlerts = z.record(
	z.string(),
	z.object({
		id: z.string(),
		item_id: z.string(),
		host: z.string(),
		kind: z.string(),
		reason: z.string(),
		identity: z.string(),
		at: z.number()
	})
);
