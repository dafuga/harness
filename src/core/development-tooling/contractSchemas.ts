// @harness-uid u_6shfrcvyqy
import { z } from 'zod';
const text = z.string().trim().min(1);
const exclusiveDefault = { not: { required: ['default', 'defaultKind'] } };

export const contractItemSchema = z
	.strictObject({
		name: text,
		type: text,
		/** Whether callers must provide this input; omitted for historical contracts that lack it. */
		required: z.boolean().optional(),
		/** A literal prop default, kept as data so contract viewers can show it exactly. */
		default: z.json().optional(),
		defaultKind: z.enum(['omitted', 'undefined']).optional(),
		description: z.string().optional(),
		/** Values a person declared as examples of the item; any JSON, kept exactly as written. */
		examples: z.array(z.json()).optional(),
		/** Why a declared boundary intentionally accepts an unknown type; required by strict checks. */
		unknownReason: text.optional()
	})
	.refine((item) => !item.defaultKind || !Object.hasOwn(item, 'default'), {
		message: 'A contract item declares either default or defaultKind.'
	})
	.meta(exclusiveDefault);

/** Additive source facts preserve every historical contract's three array fields. */
export function sourceContractSchema(item: typeof contractItemSchema) {
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
			item
				.safeExtend({
					nullable: z.boolean().optional(),
					primaryKey: z.boolean().optional(),
					validation: text.optional(),
					relations: text.optional()
				})
				.meta(exclusiveDefault)
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
