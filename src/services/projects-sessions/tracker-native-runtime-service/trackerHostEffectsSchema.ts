// @harness-uid u_bl6xl2h4a3
import { isAbsolute } from 'node:path';
import { z } from 'zod';

const absolutePath = z.string().refine(isAbsolute);
const driver = absolutePath;
const checkpoint = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/);

export const trackerHostEffectsSchema = z.discriminatedUnion('mode', [
	z.strictObject({ mode: z.literal('held') }),
	z.strictObject({
		mode: z.literal('active'),
		checkpoint,
		launch: z
			.strictObject({
				driver,
				repositories: z.record(
					z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/),
					z.strictObject({ repo: absolutePath, platform: z.enum(['linux', 'macos']) })
				),
				due: z.literal(true).optional()
			})
			.optional(),
		watchdog: z
			.union([
				z.strictObject({ driver, chiefOfStaff: z.literal(true).optional() }),
				z.strictObject({ tmux: absolutePath, chiefOfStaff: z.literal(true).optional() })
			])
			.optional(),
		adapter: z
			.union([
				z.strictObject({ driver }),
				z.strictObject({
					github: z.strictObject({ executable: absolutePath, configDirectory: absolutePath })
				})
			])
			.optional()
	})
]);
