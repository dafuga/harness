import type { ModuleResource } from '../../src/services/module-system/moduleDefinition.types';
import { test } from 'vitest';
import { moduleResourceLocation } from '../../src/helpers/module-system/moduleResourceLocation';
import { recordExampleCases } from '../support/recordExampleCases';
import { expect } from '../verificationExpect';

const scope = {
	branch: 'main',
	commit: '0123456789abcdef0123456789abcdef01234567'
};

function resource(id: string, catalog?: ModuleResource['catalog']): ModuleResource {
	return {
		id,
		title: `${id} resource`,
		singular: `${id} item`,
		kind: 'config',
		instructions: [`Create the ${id} resource.`],
		files: [{ path: `src/${id}.ts`, contents: 'export {};' }],
		...(catalog ? { catalog } : {})
	};
}

test('Routes module resources to their declared destinations', () => {
	const resources = [
		resource('access', 'permissions'),
		resource('library', 'module-library'),
		resource('colors', 'styles'),
		resource('packages', 'dependencies'),
		resource('overview', 'components'),
		resource('setup')
	];
	const cases = resources.map((item) => {
		const input = { scope, module: 'reports', resource: item };
		const output = moduleResourceLocation(scope, 'reports', item);
		return { name: item.id, input, output };
	});
	expect(cases.map((item) => item.output)).toEqual([
		{ ...scope, category: 'pages', screen: 'permissions' },
		{ ...scope, category: 'pages', screen: 'modules' },
		{ ...scope, category: 'pages', screen: 'styles' },
		{ ...scope, category: 'pages', screen: 'dependencies' },
		{ ...scope, category: 'components' },
		{ ...scope, category: 'pages', screen: 'module-resources', entity: 'reports.setup' }
	]);
	recordExampleCases(
		{
			unitId: 'helper.module-system-module-resource-location',
			symbol: 'moduleResourceLocation',
			state: 'routes-module-resources-to-their-declared-destinations',
			evidence: 'examples-cases',
			file: 'routes-module-resources-to-their-declared-destinations.json'
		},
		cases
	);
});
