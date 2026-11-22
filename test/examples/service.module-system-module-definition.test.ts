import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import {
	moduleDefinitionSchema,
	moduleResourceSchema,
	moduleStateSchema,
	moduleStateFile
} from '../../src/services/module-system/moduleDefinition';
import type { ModuleDefinition } from '../../src/services/module-system/moduleDefinition.types';

const templateResource = {
	id: 'example-api',
	title: 'Example API',
	singular: 'API',
	kind: 'example-kind',
	instructions: ['Create the API route.'],
	files: [{ path: 'src/api.ts', contents: 'export {};' }]
};

const generatorResource = {
	id: 'model-entity',
	title: 'Models',
	singular: 'Model',
	kind: 'model-kind',
	instructions: ['Generate the model.'],
	generator: { kind: 'scaffold', scaffold: 'model' }
};

const definition: ModuleDefinition = {
	schemaVersion: 1,
	id: 'example-module',
	version: '1.0.0',
	title: 'Example module',
	description: 'Adds an example API.',
	instructions: ['Install the example.'],
	setup: [],
	dependencies: {},
	resources: [templateResource]
};

test('Parses a module definition with a template resource', () => {
	const parsed = moduleDefinitionSchema.parse(definition);

	expect(parsed).toEqual(definition);
	recordExampleCases(
		{
			unitId: 'service.module-system-module-definition',
			symbol: 'moduleDefinitionSchema',
			state: 'parses-a-module-definition-with-a-template-resource',
			evidence: 'examples-cases',
			file: 'parses-a-module-definition-with-a-template-resource.json'
		},
		[
			{
				name: 'module with one template-file resource parses unchanged',
				input: { id: definition.id, version: definition.version, resources: ['example-api'] },
				output: { id: parsed.id, resourceIds: parsed.resources.map((resource) => resource.id) }
			}
		]
	);
});

test('Rejects a resource that declares both files and a generator', () => {
	const invalid = { ...templateResource, generator: { kind: 'dependency' } };
	const result = moduleResourceSchema.safeParse(invalid);

	expect(result.success).toBe(false);
	recordExampleCases(
		{
			unitId: 'service.module-system-module-definition',
			symbol: 'moduleResourceSchema',
			state: 'rejects-a-resource-that-declares-both-files-and-a-generator',
			evidence: 'examples-cases',
			file: 'rejects-a-resource-that-declares-both-files-and-a-generator.json'
		},
		[
			{
				name: 'files and generator together are rejected by the exclusivity check',
				input: { id: invalid.id, files: 1, generator: 'dependency' },
				error: {
					name: 'ZodError',
					messages: result.success ? [] : result.error.issues.map((issue) => issue.message)
				}
			}
		]
	);
});

test('Rejects a module definition with duplicate resource ids', () => {
	const duplicate = { ...definition, resources: [templateResource, { ...generatorResource, id: 'example-api' }] };
	const result = moduleDefinitionSchema.safeParse(duplicate);

	expect(result.success).toBe(false);
	recordExampleCases(
		{
			unitId: 'service.module-system-module-definition',
			symbol: 'moduleDefinitionSchema',
			state: 'rejects-a-module-definition-with-duplicate-resource-ids',
			evidence: 'examples-cases',
			file: 'rejects-a-module-definition-with-duplicate-resource-ids.json'
		},
		[
			{
				name: 'two resources sharing the id example-api are rejected',
				input: { resourceIds: ['example-api', 'example-api'] },
				error: {
					name: 'ZodError',
					messages: result.success ? [] : result.error.issues.map((issue) => issue.message)
				}
			}
		]
	);
});

test('Parses persisted module state and names its state file', () => {
	const state = {
		schemaVersion: 1,
		modules: [{ definition, source: 'builtin' }],
		resources: [{ module: 'example-module', type: 'example-api', name: 'users', files: ['src/api.ts'] }]
	};
	const parsed = moduleStateSchema.parse(state);

	expect(parsed).toEqual(state);
	expect(moduleStateFile).toBe('harness.modules.json');
	recordExampleCases(
		{
			unitId: 'service.module-system-module-definition',
			symbol: 'moduleStateSchema',
			state: 'parses-persisted-module-state-and-names-its-state-file',
			evidence: 'examples-cases',
			file: 'parses-persisted-module-state-and-names-its-state-file.json'
		},
		[
			{
				name: 'one builtin module and one resource instance parse unchanged',
				input: { module: 'example-module', type: 'example-api', name: 'users' },
				output: { file: moduleStateFile, modules: parsed.modules.length, resources: parsed.resources.length }
			}
		]
	);
});
