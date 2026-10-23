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
	category: z.enum(['page', 'shell', 'layout', 'component', 'function', 'config', 'service']),
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
const optionId = z.string().regex(/^o([1-9]|10)$/);
const words = z.string().refine((value) => value.trim().length > 0);
/** A rectangle of an image as planning writes it: never empty and never past an edge. */
const region = z
	.object({
		...{ x: z.number().min(0), y: z.number().min(0) },
		...{ width: z.number().positive(), height: z.number().positive() }
	})
	.refine((value) => value.x + value.width <= 1 && value.y + value.height <= 1);
/** A design option as planning stores it: direction, exact prompt, generator and own images. */
const hubOptionSchema = z.strictObject({
	id: optionId,
	direction: words,
	prompt: stored.nullable(),
	revisedPrompt: words.nullable(),
	generator: z.strictObject({ provider: words, model: words }),
	images: z.array(stored).min(1)
});
/** The exact earlier image, and the rectangle of it, that a version was made from. */
// Records written before options are read as before: a key this reader does not use is ignored.
const hubRevisionSchema = z.object({
	version: z.string().regex(/^v\d{3,}$/),
	file,
	imageSha256: hash,
	region: region.nullable(),
	threadId: z.string().uuid().nullable(),
	option: optionId.optional()
});
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
	),
	/** Left out by a version written before revisions or options were recorded. */
	revises: hubRevisionSchema.nullable().optional(),
	options: z.array(hubOptionSchema).min(1).max(10).optional()
});
export const hubApprovalSchema = z.object({
	id: z.string().uuid(),
	unitId: z.string(),
	version: z.string(),
	images: z.array(stored),
	notesSha256: hash.nullable(),
	contractHash: hash,
	approvedAt: z.string().datetime(),
	/** The one option approved, when its version has options. */
	option: optionId.optional()
});
export function hubSchemas<T>(schema: z.ZodType<T>, value: unknown): T {
	const parsed = schema.safeParse(value);
	if (!parsed.success)
		throw Object.assign(new Error('Invalid Harness artifact'), { code: 'artifact-corrupt' });
	return parsed.data;
}

export type { HubPlan, HubDesign, HubApproval } from './hubSchemas.types';
