// @harness-uid u_bl6xl2h4a3
import { isAbsolute } from 'node:path';
import { z } from 'zod';

const absolutePath = z.string().refine(isAbsolute);
const driver = absolutePath;
const adapterPolicy = {
	manual: z.literal(true).optional(),
	followUp: z
		.strictObject({
			target: z.string().regex(/^[a-z0-9][a-z0-9-]*\/[a-z0-9_.-]+$/),
			author: z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9-]{0,38}$/),
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
	transcriptRoots: transcriptRoots.optional()
};
const checkpoint = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/);

const launchPolicy = {
	maxConcurrent: z.int().positive().max(500).optional(),
	legacyRunDirectory: absolutePath.optional(),
	repositories: z.record(
		z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/),
		z.strictObject({ repo: absolutePath, platform: z.enum(['linux', 'macos']) })
	),
	due: z.literal(true).optional()
};
const managedLauncher = z
	.strictObject({
		tmux: absolutePath,
		stateDirectory: absolutePath,
		trackerBinDirectory: absolutePath,
		native: z
			.strictObject({ codex: absolutePath, claude: absolutePath, profile: absolutePath })
			.optional(),
		docker: z
			.strictObject({
				harness: absolutePath,
				image: z.string().regex(/^sha256:[a-f0-9]{64}$/),
				profile: absolutePath
			})
			.optional()
	})
	.refine(({ native, docker }) => Boolean(native ?? docker));

export const trackerHostEffectsSchema = z.discriminatedUnion('mode', [
	z.strictObject({ mode: z.literal('held') }),
	z.strictObject({
		mode: z.literal('active'),
		checkpoint,
		launch: z
			.union([
				z.strictObject({ driver, ...launchPolicy }),
				z.strictObject({ managed: managedLauncher, ...launchPolicy })
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
