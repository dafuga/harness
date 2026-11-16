import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { ModuleCatalogService } from '../../src/services/module-system/ModuleCatalogService';

const definition = {
	schemaVersion: 1,
	id: 'field-notes',
	version: '1.0.0',
	title: 'Field Notes',
	description: 'Provides a notes component.',
	instructions: ['Use the notes component for project notes.'],
	setup: [],
	dependencies: {},
	resources: [
		{
			id: 'note',
			title: 'Note',
			singular: 'Note',
			kind: 'component',
			instructions: ['Create a note component.'],
			files: [{ path: 'src/components/NoteCard.ts', contents: 'export const NoteCard = true;' }]
		}
	]
};

const installedState = {
	schemaVersion: 1,
	modules: [{ definition, source: 'project' }],
	resources: [
		{
			module: 'field-notes',
			type: 'note',
			name: 'weekly-review',
			files: ['src/components/NoteCard.ts']
		}
	]
};

test('Discovers project modules and installed resources', async () => {
	const files = new Map([
		['specification/modules/field-notes/module.json', JSON.stringify(definition)],
		['harness.modules.json', JSON.stringify(installedState)]
	]);
	const catalog = await new ModuleCatalogService().at({
		list: async () => [{ path: 'specification/modules/field-notes/module.json' }],
		read: async (path) => {
			const value = files.get(path);
			if (value === undefined) throw new Error(`Missing file: ${path}`);
			return value;
		}
	});
	const module = catalog.modules.find((entry) => entry.definition.id === 'field-notes');

	expect(catalog.gaps).toEqual([]);
	expect(module).toMatchObject({
		source: 'project',
		installed: true,
		instances: [{ module: 'field-notes', type: 'note', name: 'weekly-review' }]
	});
	recordExampleCases(
		{
			unitId: 'service.module-system-module-catalog',
			symbol: 'at',
			state: 'discovers-project-modules-and-installed-resources',
			evidence: 'examples-cases',
			file: 'discovers-project-modules-and-installed-resources.json'
		},
		[
			{
				name: 'valid project definition joins its installed resource instance',
				input: { definition, installedState },
				output: {
					gaps: catalog.gaps,
					module: {
						id: module?.definition.id,
						source: module?.source,
						installed: module?.installed,
						instances: module?.instances
					}
				}
			}
		]
	);
});
