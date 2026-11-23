import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'vitest';
import { ModuleResourceService } from '../../src/services/module-system/ModuleResourceService';
import { ModuleResourceGenerationError } from '../../src/services/module-system/ModuleResourceService.types';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { expect } from '../verificationExpect';

const unitId = 'service.module-system-module-resource';
const definition = {
	schemaVersion: 1,
	id: 'ui-kit',
	version: '1.0.0',
	title: 'UI Kit',
	description: 'Example module for resource generation.',
	instructions: ['Use the included component templates.'],
	setup: [],
	dependencies: {},
	resources: [
		{
			id: 'component',
			title: 'Component',
			singular: 'component',
			kind: 'component',
			instructions: ['Add a reusable component.'],
			files: [
				{
					path: 'src/components/{{name}}/{{PascalName}}.tsx',
					contents: 'export function {{PascalName}}() { return null; }\n'
				}
			]
		}
	]
};

function installExampleModule(root: string): void {
	writeFileSync(
		join(root, 'harness.modules.json'),
		JSON.stringify({
			schemaVersion: 1,
			modules: [{ definition, source: 'project' }],
			resources: []
		})
	);
}

test('Generates a declared component resource', async () => {
	await withTempDir('module-resource-generate-', async (root) => {
		installExampleModule(root);
		const input = { root, module: 'ui-kit', type: 'component', requested: 'evidence-grid' };
		const output = await new ModuleResourceService().generate(
			input.root,
			input.module,
			input.type,
			input.requested
		);
		expect(output).toEqual([
			'src/components/evidence-grid/EvidenceGrid.tsx',
			'harness.modules.json'
		]);
		recordExampleCases(
			{
				unitId,
				symbol: 'ModuleResourceService.generate',
				state: 'generates-a-declared-component-resource',
				evidence: 'examples-cases',
				file: 'generates-a-declared-component-resource.json'
			},
			[
				{
					name: 'component template is expanded and its path is returned',
					input: { module: input.module, type: input.type, requested: input.requested },
					output
				}
			]
		);
		const state = JSON.parse(readFileSync(join(root, 'harness.modules.json'), 'utf8'));
		expect(state.resources).toEqual([
			{
				module: 'ui-kit',
				type: 'component',
				name: 'evidence-grid',
				files: ['src/components/evidence-grid/EvidenceGrid.tsx']
			}
		]);
	});
});

test('Rejects a duplicate resource name', async () => {
	await withTempDir('module-resource-duplicate-', async (root) => {
		installExampleModule(root);
		const service = new ModuleResourceService();
		await service.generate(root, 'ui-kit', 'component', 'evidence-grid');
		let error: unknown;
		try {
			await service.generate(root, 'ui-kit', 'component', 'Evidence Grid');
		} catch (caught) {
			error = caught;
		}
		expect(error).toBeInstanceOf(ModuleResourceGenerationError);
		expect((error as Error).message).toBe('Resource Evidence Grid already exists.');
		recordExampleCases(
			{
				unitId,
				symbol: 'ModuleResourceService.generate',
				state: 'rejects-a-duplicate-resource-name',
				evidence: 'examples-cases',
				file: 'rejects-a-duplicate-resource-name.json'
			},
			[
				{
					name: 'PascalCase-equivalent resource name is rejected',
					input: { module: 'ui-kit', type: 'component', requested: 'Evidence Grid' },
					error: {
						name: (error as Error).name,
						message: (error as Error).message
					}
				}
			]
		);
	});
});
