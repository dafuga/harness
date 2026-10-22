import { z } from 'zod';

const errorType = z.enum(['console', 'pageerror']);
const observed = z.strictObject({
	type: errorType,
	message: z.string(),
	page: z.string(),
	source: z.string().optional(),
	line: z.number().int().nonnegative().optional(),
	column: z.number().int().nonnegative().optional(),
	stack: z.string().optional()
});
const expected = z.strictObject({
	type: errorType,
	message: z.string().min(1),
	reason: z.string().min(1),
	source: z.string().optional()
});

/** One test attempt's observations, retained even when its log assertion fails. */
export const browserDiagnosticSchema = z.strictObject({
	test: z.string().min(1),
	file: z.string(),
	project: z.string(),
	retry: z.number().int().nonnegative(),
	browser: z.string().optional(),
	errors: z.array(observed),
	expected: z.array(expected)
});

export type BrowserDiagnostic = z.infer<typeof browserDiagnosticSchema>;
