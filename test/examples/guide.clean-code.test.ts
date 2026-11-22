import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { cleanCodeGuide } from '../../src/guides/development-tooling/cleanCode';

test('Provides clean-code review guidance', () => {
	expect(cleanCodeGuide.topic).toBe('clean-code');
	expect(cleanCodeGuide.steps).toHaveLength(5);
	expect(cleanCodeGuide.rules).toContain(
		'Normal audits stay offline when cleanCode.mode is off.'
	);
	recordExampleCases(
		{
			unitId: 'guide.clean-code',
			symbol: 'cleanCodeGuide',
			state: 'provides-clean-code-review-guidance',
			evidence: 'examples-cases',
			file: 'provides-clean-code-review-guidance.json'
		},
		[
			{
				name: 'documents the Jev review workflow and gate guidance',
				input: {},
				output: {
					topic: cleanCodeGuide.topic,
					summary: cleanCodeGuide.summary,
					stepCount: cleanCodeGuide.steps.length,
					ruleCount: cleanCodeGuide.rules.length,
					antiPatternCount: cleanCodeGuide.antiPatterns.length,
					exampleCommands: cleanCodeGuide.exampleCommands
				}
			}
		]
	);
});
