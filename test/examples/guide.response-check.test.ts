import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { responseCheckGuide } from '../../src/guides/verification-evidence/responseCheck';

test('Presents the response-check workflow and limits', () => {
	const guide = responseCheckGuide;
	expect(guide.topic).toBe('response-check');
	expect(guide.steps).toHaveLength(4);
	expect(guide.rules).toHaveLength(7);
	expect(guide.antiPatterns).toHaveLength(3);
	expect(guide.exampleCommands).toHaveLength(2);

	recordExampleCases(
		{
			unitId: 'guide.response-check',
			symbol: 'responseCheckGuide',
			state: 'presents-the-response-check-workflow-and-limits',
			evidence: 'examples-cases',
			file: 'presents-the-response-check-workflow-and-limits.json'
		},
		[
			{
				name: 'documents the response-check workflow',
				input: {},
				output: {
					topic: guide.topic,
					summary: guide.summary,
					steps: guide.steps,
					rules: guide.rules,
					antiPatterns: guide.antiPatterns,
					exampleCommands: guide.exampleCommands
				}
			}
		]
	);
});
