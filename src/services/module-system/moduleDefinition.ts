import { z } from 'zod';
import { scaffoldKinds } from '../../templates/development-tooling/scaffoldTypes';

const id = z.string().regex(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/);
const text = z.string().trim().min(1);
export const moduleFileSchema = z.strictObject({ path: text, contents: z.string() });
export const moduleResourceSchema = z
	.strictObject({
		id,
		title: text,
		singular: text,
		kind: id,
		instructions: z.array(text).min(1),
		files: z.array(moduleFileSchema).default([]),
		catalog: z
			.enum([
				'layouts',
				'components',
				'models',
				'services',
				'functions',
				'types',
				'configs',
				'styles',
				'dependencies'
			])
			.optional(),
		primary: z.boolean().optional(),
		generator: z
			.discriminatedUnion('kind', [
				z.strictObject({
					kind: z.literal('scaffold'),
					scaffold: z.enum(['model', ...scaffoldKinds]),
					level: z.enum(['molecule', 'organism']).optional()
				}),
				z.strictObject({ kind: z.literal('dependency') })
			])
			.optional()
	})
	.superRefine((resource, context) => {
		if (Boolean(resource.files.length) === Boolean(resource.generator))
			context.addIssue({
				code: 'custom',
				message: 'Declare template files or a generator, exclusively.'
			});
	});
export const moduleDefinitionSchema = z
	.strictObject({
		schemaVersion: z.literal(1),
		id,
		version: z.string().regex(/^\d+\.\d+\.\d+$/),
		title: text,
		description: text,
		appOnly: z.boolean().optional(),
		includedByDefault: z.boolean().optional(),
		order: z.number().int().min(0).max(10000).optional(),
		packageScripts: z.record(z.string(), text).optional(),
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
