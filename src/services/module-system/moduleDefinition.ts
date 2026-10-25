import { z } from 'zod';

const id = z.string().regex(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/);
const text = z.string().trim().min(1);
export const moduleFileSchema = z.strictObject({ path: text, contents: z.string() });
export const moduleResourceSchema = z.strictObject({
	id,
	title: text,
	singular: text,
	kind: id,
	instructions: z.array(text).min(1),
	files: z.array(moduleFileSchema).min(1)
});
export const moduleDefinitionSchema = z
	.strictObject({
		schemaVersion: z.literal(1),
		id,
		version: z.string().regex(/^\d+\.\d+\.\d+$/),
		title: text,
		description: text,
		appOnly: z.boolean().optional(),
		instructions: z.array(text).min(1),
		setup: z.array(moduleFileSchema),
		dependencies: z.record(z.string(), text),
		devDependencies: z.record(z.string(), text).optional(),
		resources: z.array(moduleResourceSchema).min(1)
	})
	.superRefine((module, context) => {
		const ids = module.resources.map((resource) => resource.id);
		if (new Set(ids).size !== ids.length)
			context.addIssue({ code: 'custom', message: 'Duplicate module resource type.' });
	});
export const moduleStateSchema = z.strictObject({
	schemaVersion: z.literal(1),
	modules: z.array(
		z.strictObject({ definition: moduleDefinitionSchema, source: z.enum(['builtin', 'project']) })
	),
	resources: z.array(
		z.strictObject({ module: id, type: id, name: text, files: z.array(text).min(1) })
	)
});
export const moduleStateFile = 'harness.modules.json';
