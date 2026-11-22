// @harness-uid u_bl6xl2h4a3
import { z } from 'zod';

const author = z.object({ login: z.string().max(100), type: z.string().max(40).optional() });
const date = z.iso.datetime({ offset: true });
const label = z.object({ name: z.string().max(100) });

export const adapterIssues = z
	.array(
		z.object({
			id: z.int().positive(),
			number: z.int().positive(),
			title: z.string().max(1024),
			state: z.enum(['open', 'closed']),
			created_at: date,
			updated_at: date,
			labels: z.array(label).max(100),
			pull_request: z.unknown().optional(),
			user: author.nullish().transform((user) => user ?? undefined)
		})
	)
	.max(5000);

export const adapterTimeline = z
	.array(
		z.object({
			id: z.union([z.int(), z.string()]).optional(),
			event: z.string().optional(),
			created_at: date,
			label: label.optional(),
			actor: author.nullish().transform((actor) => actor ?? undefined)
		})
	)
	.max(5000);

export const adapterComments = z
	.array(
		z.object({
			id: z.int().positive(),
			issue_url: z.string().max(512),
			created_at: date,
			user: author.nullish().transform((user) => user ?? undefined),
			performed_via_github_app: z.unknown().optional()
		})
	)
	.max(5000);

export const adapterWrite = z.strictObject({ acknowledged: z.literal(true) });
