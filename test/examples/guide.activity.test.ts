import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { activityGuide } from '../../src/guides/projects-sessions/activity';

test('Provides activity guidance', () => {
	const output = {
		topic: activityGuide.topic,
		summary: activityGuide.summary,
		stepCount: activityGuide.steps.length,
		ruleCount: activityGuide.rules.length,
		antiPatternCount: activityGuide.antiPatterns.length,
		exampleCommands: activityGuide.exampleCommands
	};
	expect(output.topic).toBe('activity');
	recordExampleCases(
		{
			unitId: 'guide.activity',
			symbol: 'activityGuide',
			state: 'provides-activity-guidance',
			evidence: 'examples-cases',
			file: 'provides-activity-guidance.json'
		},
		[
			{
				name: 'summarizes repository activity and agent lifecycle guidance',
				input: {},
				output
			}
		]
	);
});
