import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { verificationGuides } from '../../src/guides/verification-evidence/verification';

test('Exposes scenario verification guidance', () => {
	const scenarioGuide = verificationGuides.find((guide) => guide.topic === 'scenario');
	expect(scenarioGuide).toBeDefined();
	expect(scenarioGuide?.summary).toBe(
		'A scenario contract lists the states, viewports, checks and evidence that prove units.'
	);
	expect(scenarioGuide?.steps).toHaveLength(5);
	expect(scenarioGuide?.rules).toContain(
		'A missing state can occur but is unproven: the scenario cannot pass until it is covered.'
	);
	const output = scenarioGuide && {
		topic: scenarioGuide.topic,
		summary: scenarioGuide.summary,
		stepCount: scenarioGuide.steps.length,
		ruleCount: scenarioGuide.rules.length,
		antiPatterns: scenarioGuide.antiPatterns,
		exampleCommands: scenarioGuide.exampleCommands
	};
	recordExampleCases(
		{
			unitId: 'guide.verification',
			symbol: 'verificationGuides',
			state: 'exposes-scenario-verification-guidance',
			evidence: 'examples-cases',
			file: 'exposes-scenario-verification-guidance.json'
		},
		[
			{
				name: 'scenario guidance lists its proof requirements',
				input: [],
				output
			}
		]
	);
});
