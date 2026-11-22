import { test } from 'vitest';
import * as resources from '../../src/lib/execution-runtimes/resources';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';

const expectedExports = [
	'ResourceQueueService',
	'resourceConfig',
	'resourceConfigSchema',
	'resourceEnvironment',
	'resourcePriorities',
	'resourceRequestSchema',
	'resourceThreads',
	'resourceWork',
	'resourceWorkers',
	'saveResourceConfig'
];

function exportedNames(): string[] {
	return Object.keys(resources).sort();
}

function functionExports(): string[] {
	return exportedNames().filter(
		(name) => typeof (resources as Record<string, unknown>)[name] === 'function'
	);
}

test('Exports the managed resource API', () => {
	const names = exportedNames();
	const functions = functionExports();

	expect(names).toEqual(expectedExports);
	expect(functions).toContain('ResourceQueueService');
	expect(functions).toContain('saveResourceConfig');
	expect(resources.resourceConfigSchema).toBeDefined();
	expect(resources.resourceRequestSchema).toBeDefined();

	recordExampleCases(
		{
			unitId: 'module.resources',
			symbol: 'ResourceQueueService',
			state: 'exports-the-managed-resource-api',
			evidence: 'examples-cases',
			file: 'exports-the-managed-resource-api.json'
		},
		[
			{
				name: 'resources entrypoint exposes the published value exports',
				input: { entrypoint: 'src/lib/execution-runtimes/resources.ts' },
				output: { exports: names, functionExports: functions }
			}
		]
	);
});
