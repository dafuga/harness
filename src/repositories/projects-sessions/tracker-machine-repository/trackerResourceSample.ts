// @harness-uid u_ipklfyqj7h
import { z } from 'zod';

const amount = z.number().nonnegative();
const count = z.int().nonnegative().max(100_000);
// Labels reach item notes and Chief of Staff alerts, so peers may only send plain ones.
const label = z
	.string()
	.max(120)
	.regex(/^[\w .:@-]+$/);

const systemGroup = z.object({
	pid: z.int().nonnegative(),
	label,
	procs: count,
	cpu: amount,
	rss_mb: amount
});

const group = systemGroup.extend({ kind: z.enum(['claude', 'codex', 'test-runner', 'browser']) });

const disk = z.object({
	mount: z
		.string()
		.max(120)
		.regex(/^\/[\w./-]*$/),
	total_gb: amount,
	free_gb: amount,
	free_pct: amount
});

/** Validates a resource sample from this computer's database or a fleet peer. */
export const trackerResourceSample = z.object({
	at: z.iso.datetime(),
	platform: z.string().max(20),
	cores: z.int().positive().max(1024),
	load: z.array(amount).length(3),
	cpu_busy_pct: z.number().nullable(),
	ram: z.object({
		total_mb: amount,
		used_mb: z.number(),
		available_mb: amount,
		available_pct: amount,
		pressure: z.enum(['normal', 'warn', 'critical']).optional(),
		pressure_free_pct: amount.optional()
	}),
	swap: z.object({ total_mb: amount, used_mb: amount }),
	disks: z.array(disk).max(10),
	agents: z.object({ claude: count, codex: count, test_runners: count, browsers: count }),
	top_cpu: z.array(group).max(5),
	top_rss: z.array(group).max(5),
	system_cpu: z.array(systemGroup).max(5).optional(),
	system_rss: z.array(systemGroup).max(5).optional(),
	system_groups: z.array(systemGroup).max(5).optional(),
	disk_users: z
		.array(z.object({ label, used_gb: amount }))
		.max(3)
		.optional()
});
