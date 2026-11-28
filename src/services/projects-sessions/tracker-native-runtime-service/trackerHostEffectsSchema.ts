// @harness-uid u_bl6xl2h4a3
import { isAbsolute } from 'node:path';
import { z } from 'zod';
import { trackerEgressPolicy } from '../../../utils/projects-sessions/trackerEgressPolicy';
import { trackerRunLimits } from './trackerHostRunLimits';
import { hostVerify, hostWorktrees, noVerify } from './trackerHostVerifyPolicy';

const absolutePath = z.string().refine(isAbsolute);
const driver = absolutePath;
const adapterPolicy = {
	gmail: z.strictObject({ account: z.email(), tokenDriver: absolutePath }).optional(),
	manual: z.literal(true).optional(),
	followUp: z
		.strictObject({
			target: z.string().regex(/^[a-z0-9][a-z0-9-]*\/[a-z0-9_.-]+$/),
			author: z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9-]{0,38}$/),
			additionalAuthors: z
				.array(z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9-]{0,38}$/))
				.max(10)
				.optional(),
			titlePrefix: z.string().trim().min(1).max(80),
			issueInstructions: z.string().trim().min(1).max(6000),
			instructions: z.string().trim().min(1).max(6000),
			coveredComments: z
				.record(z.string().regex(/^[1-9][0-9]{0,15}$/), z.string().regex(/^[0-9a-z]{10}$/))
				.optional()
		})
		.optional(),
	scheduleDue: z.literal(true).optional(),
	dueDisk: z
		.strictObject({ freePct: z.number().positive().max(100), freeGB: z.number().positive() })
		.optional()
};
const transcriptRoots = z.array(absolutePath).min(1).max(12);
const watchdogPolicy = {
	chiefOfStaff: z.literal(true).optional(),
	idleWorkMinutes: z.int().positive().max(1440).optional(),
	transcriptRoots: transcriptRoots.optional()
};
const checkpoint = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/);

const launchPolicy = {
	maxConcurrent: z.int().positive().max(500).optional(),
	nonHarborSessionLimit: z.int().positive().max(500).optional(),
	legacyRunDirectory: absolutePath.optional(),
	...trackerRunLimits,
	minAvailableMemMB: z.int().positive().optional(),
	minFreeDiskGB: z.number().positive().optional(),
	repositories: z.record(
		z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/),
		z.strictObject({
			repo: absolutePath,
			platform: z.enum(['linux', 'macos']),
			verify: z.string().trim().min(1).max(2000).optional(),
			worktree: z.boolean().optional()
		})
	),
	due: z.boolean().optional(),
	codexPausedUntil: z.iso.datetime({ offset: true }).optional()
};
const egressHost = z.string().trim().min(1).max(253);
const egressPilot = z
	.strictObject({
		items: z
			.array(z.string().regex(/^[a-z0-9]{10}$/))
			.min(1)
			.max(20),
		trackerHosts: z.array(egressHost).min(1).max(20),
		projectHosts: z.array(egressHost).max(50).optional()
	})
	.transform(({ items, ...hosts }, ctx) => {
		try {
			return { items, policy: trackerEgressPolicy(hosts) };
		} catch (error) {
			ctx.addIssue({ code: 'custom', message: (error as Error).message });
			return z.NEVER;
		}
	});
const managedLauncher = z
	.strictObject({
		tmux: absolutePath,
		stateDirectory: absolutePath,
		trackerBinDirectory: absolutePath,
		opsWorkdir: absolutePath.optional(),
		native: z
			.strictObject({
				codex: absolutePath,
				claude: absolutePath,
				profile: absolutePath,
				egress: egressPilot.optional()
			})
			.optional(),
		docker: z
			.strictObject({
				harness: absolutePath,
				image: z.string().regex(/^sha256:[a-f0-9]{64}$/),
				profile: absolutePath
			})
			.optional()
	})
	.refine(
		({ native, docker, opsWorkdir }) =>
			Boolean(native ?? docker) && (!opsWorkdir || Boolean(native))
	);

export const trackerHostEffectsSchema = z.discriminatedUnion('mode', [
	z.strictObject({ mode: z.literal('held') }),
	z.strictObject({
		mode: z.literal('active'),
		checkpoint,
		launch: z
			.union([
				z
					.strictObject({ driver, ...launchPolicy })
					.refine(...noVerify)
					.refine(...hostWorktrees),
				z
					.strictObject({ managed: managedLauncher, ...launchPolicy })
					.refine(...hostVerify)
					.refine(...hostWorktrees)
			])
			.optional(),
		watchdog: z
			.union([
				z.strictObject({ driver, ...watchdogPolicy }),
				z.strictObject({ tmux: absolutePath, ...watchdogPolicy }),
				z.strictObject({ transcriptRoots, chiefOfStaff: z.never().optional() })
			])
			.optional(),
		adapter: z
			.union([
				z.strictObject({ driver, ...adapterPolicy }),
				z.strictObject({
					github: z.strictObject({ executable: absolutePath, configDirectory: absolutePath }),
					...adapterPolicy
				})
			])
			.optional()
	})
]);
