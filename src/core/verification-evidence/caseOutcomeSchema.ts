import { z } from 'zod';

/** Repository-relative case identities; runner observations never author expectations. */
export const caseFileSchema = z
	.string()
	.trim()
	.min(1)
	.refine(
		(value) =>
			!value.startsWith('/') && !value.split('/').some((part) => ['', '.', '..'].includes(part))
	);
export const caseOutcomeSchema = z.strictObject({
	file: caseFileSchema,
	title: z.string().trim().min(1),
	revision: z.string().regex(/^[a-f0-9]{40}$/),
	status: z.enum(['passed', 'failed', 'skipped']),
	retry: z.number().int().nonnegative().default(0)
});
export const evidenceArtifactSchema = z.strictObject({
	path: z.string().min(1),
	sha256: z.string().regex(/^[0-9a-f]{64}$/),
	bytes: z.number().int().nonnegative()
});
