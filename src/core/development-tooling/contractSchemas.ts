// @harness-uid u_6shfrcvyqy
import { z } from 'zod';
import type { contractItemSchema } from './unitTypes';

/** Additive source facts preserve every historical contract's three array fields. */
export function sourceContractSchema(item: typeof contractItemSchema) {
	const text = z.string().trim().min(1);
	const status = z.enum(['declared', 'none-found', 'unknown', 'found']);
	const operation = z.strictObject({
		name: text,
		inputs: z.array(item),
		outputs: z.array(item),
		errors: z.array(item),
		errorStatus: status
	});
	const storage = z.strictObject({
		name: text,
		table: text.optional(),
		primaryKey: text.optional(),
		fields: z.array(
			item.extend({
				nullable: z.boolean().optional(),
				primaryKey: z.boolean().optional(),
				validation: text.optional(),
				relations: text.optional()
			})
		),
		validation: text.optional(),
		relations: text.optional(),
		unresolved: z.array(text).optional()
	});
	return z.strictObject({
		origin: z.enum(['derived', 'declared']),
		primitives: z.array(text).optional(),
		inputs: z.array(item),
		outputs: z.array(item),
		errors: z.array(item),
		errorStatus: status.optional(),
		operations: z.array(operation).optional(),
		initialization: z.array(operation).optional(),
		snippets: z.array(operation).optional(),
		storage: z.array(storage).optional()
	});
}
