import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { resourcesGuide } from '../../src/guides/execution-runtimes/resources';

test('Documents shared resource admission limits', () => {
	const output = {
		topic: resourcesGuide.topic,
		steps: resourcesGuide.steps,
		rules: resourcesGuide.rules,
		antiPatterns: resourcesGuide.antiPatterns,
		exampleCommands: resourcesGuide.exampleCommands
	};
	expect(resourcesGuide.topic).toBe('resources');
	expect(resourcesGuide.steps).toContain(
		'Raise reserves with harness resources configure; defaults are 10% CPU and the larger of 10% RAM or 2048 MiB.'
	);
	expect(resourcesGuide.rules).toContain(
		'Queue waiting defaults to 30 minutes; execution --timeout defaults to six hours. Cancellation cleans owned work only.'
	);
	expect(resourcesGuide.antiPatterns[0]).toContain('not OS hard quotas');
	recordExampleCases(
		{
			unitId: 'guide.resources',
			symbol: 'resourcesGuide',
			state: 'documents-shared-resource-admission-limits',
			evidence: 'examples-cases',
			file: 'documents-shared-resource-admission-limits.json'
		},
		[
			{
				name: 'documents priorities, reserve floors, waits and estimate limits',
				input: {},
				output
			}
		]
	);
});
