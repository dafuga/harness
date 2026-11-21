// @harness-uid u_bl6xl2h4a3
import { isAbsolute } from 'node:path';
import { z } from 'zod';

const absolutePath = z.string().refine(isAbsolute);
const driver = absolutePath;
const adapterPolicy = {
	scheduleDue: z.literal(true).optional(),
	dueDisk: z
		.strictObject({ freePct: z.number().positive().max(100), freeGB: z.number().positive() })
		.optional()
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
				z.strictObject({ driver, chiefOfStaff: z.literal(true).optional() }),
				z.strictObject({ tmux: absolutePath, chiefOfStaff: z.literal(true).optional() })
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
