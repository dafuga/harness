// @harness-uid u_bl6xl2h4a3
import { z } from 'zod';

export const claudeStartupFailure = z.enum([
	'claude-sign-in',
	'claude-auth-unverified',
	'claude-onboarding',
	'claude-trust',
	'claude-not-ready'
]);

export const hostSession = z.strictObject({
	itemId: z.string().min(1).max(80),
	key: z.string().min(1).max(512),
	id: z.string().min(1).max(200),
	state: z.enum(['live', 'exited', 'lost']),
	startedAt: z.int().nonnegative(),
	activityAt: z.int().nonnegative().optional(),
	exitCode: z.int().min(0).max(255).optional(),
	tmux: z
		.string()
		.regex(/^auto-[a-z0-9]{6,10}-r[0-9]+$/)
		.optional(),
	legacyRunId: z.int().positive().optional(),
	startupFailure: claudeStartupFailure.optional()
});

export const hostInventory = z
	.array(hostSession)
	.max(500)
	.refine(
		(sessions) =>
			new Set(sessions.map(({ key }) => key)).size === sessions.length &&
			new Set(sessions.map(({ id }) => id)).size === sessions.length
	);

export const hostStart = z.discriminatedUnion('status', [
	z.strictObject({ status: z.literal('started'), session: hostSession }),
	z.strictObject({ status: z.literal('pending') }),
	z.strictObject({ status: z.literal('rejected'), reason: claudeStartupFailure.optional() })
]);
