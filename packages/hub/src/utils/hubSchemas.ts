import { z } from 'zod';
const hash = z.string().regex(/^[a-f0-9]{64}$/),
	sha = z.string().regex(/^[a-f0-9]{40}$/);
const file = z
	.string()
	.regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,199}$/)
	.refine((v) => !v.includes('..'));
const field = z.object({ name: z.string(), type: z.string() });
export const hubContractSchema = z.object({
	responsibility: z.string(),
	inputs: z.array(field),
	outputs: z.array(field),
	errors: z.array(z.string()),
	states: z.array(z.string()),
	viewports: z.array(z.enum(['desktop', 'tablet', 'mobile', 'diagram']))
});
export const hubPlanSchema = z.object({
	unitId: z.string(),
	category: z.enum(['page', 'shell', 'component', 'function', 'config', 'service']),
	slug: z.string(),
	title: z.string(),
	goal: z.string(),
	path: z.string(),
	createdAt: z.string().datetime(),
	baseRevision: sha,
	contract: hubContractSchema,
	contractHash: hash
});
const stored = z.object({ file, sha256: hash });
export const hubDesignSchema = z.object({
	unitId: z.string(),
	version: z.string().regex(/^v\d{3,}$/),
	createdAt: z.string().datetime(),
	generator: z.object({ provider: z.string(), model: z.string() }),
	prompt: stored,
	notes: stored.nullable(),
	baseRevision: sha,
	contract: hubContractSchema,
	contractHash: hash,
	images: z.array(
		z.object({
			file,
			sha256: hash,
			state: z.string(),
			viewport: z.enum(['desktop', 'tablet', 'mobile', 'diagram']),
			bytes: z.number().int().positive().max(33554432),
			width: z.number().int().positive(),
			height: z.number().int().positive()
		})
	)
});
export const hubApprovalSchema = z.object({
	id: z.string().uuid(),
	unitId: z.string(),
	version: z.string(),
	images: z.array(stored),
	notesSha256: hash.nullable(),
	contractHash: hash,
	approvedAt: z.string().datetime()
});
export type HubPlan = z.infer<typeof hubPlanSchema>;
export type HubDesign = z.infer<typeof hubDesignSchema>;
export function hubSchemas<T>(schema: z.ZodType<T>, value: unknown): T {
	const parsed = schema.safeParse(value);
	if (!parsed.success)
		throw Object.assign(new Error('Invalid Harness artifact'), { code: 'artifact-corrupt' });
	return parsed.data;
}
