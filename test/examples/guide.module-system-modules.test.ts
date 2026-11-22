import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { modulesGuide } from '../../src/guides/module-system/modules';

test('Documents module discovery and authoring guidance', () => {
	const output = {
		topic: modulesGuide.topic,
		summary: modulesGuide.summary,
		steps: modulesGuide.steps,
		ruleCount: modulesGuide.rules.length,
		antiPatterns: modulesGuide.antiPatterns,
		exampleCommandCount: modulesGuide.exampleCommands.length
	};
	expect(output.topic).toBe('modules');
	expect(output.steps).toHaveLength(4);
	expect(output.ruleCount).toBe(12);
	recordExampleCases(
		{
			unitId: 'guide.module-system-modules',
			symbol: 'modulesGuide',
			state: 'documents-module-discovery-and-authoring-guidance',
			evidence: 'examples-cases',
			file: 'documents-module-discovery-and-authoring-guidance.json'
		},
		[
			{
				name: 'modules topic guidance',
				input: {},
				output
			}
		]
	);
});
