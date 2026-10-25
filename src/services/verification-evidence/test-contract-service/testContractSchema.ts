import { z } from 'zod';

const id = z.string().regex(/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/);
const text = z.string().trim().min(1);
const path = text.refine(
	(value) =>
		!value.startsWith('/') && !value.split('/').some((part) => ['..', '.', ''].includes(part)),
	'must be a repository-relative path'
);
const expected = z.discriminatedUnion('kind', [
	z.strictObject({ kind: z.literal('void') }),
	z.strictObject({ kind: z.literal('screenshot'), file: path }),
	z.strictObject({ kind: z.literal('json'), value: z.json(), normalize: z.array(text).optional() }),
	z.strictObject({ kind: z.literal('value'), value: z.json() }),
	z.strictObject({ kind: z.literal('error'), value: z.json() })
]);

/** Stable authored cases; observations never replace these expectations. */
export const testContractSchema = z.strictObject({
	version: z.literal(1),
	shape: z.enum(['page', 'component', 'helper', 'service', 'api']),
	states: z.array(id).min(1).optional(),
	props: z.array(text).optional(),
	cases: z
		.array(
			z.strictObject({
				id,
				state: id,
				subject: text.optional(),
				example: text.optional(),
				fixture: path.optional(),
				call: text.optional(),
				input: z.json().optional(),
				test: z.strictObject({ file: path, title: text }),
				expected: expected.optional(),
				viewports: z.array(id).min(1).optional(),
				props: z.array(text).optional(),
				errors: z.array(text).optional(),
				artifacts: z
					.array(z.strictObject({ kind: z.enum(['audio', 'output', 'trace']), evidence: id }))
					.optional()
			})
		)
		.min(1)
});
