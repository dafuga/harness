import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { loopGuide } from '../../src/guides/development-tooling/loop';

test('Provides loop workflow guidance', () => {
	const output = {
		topic: loopGuide.topic,
		summary: loopGuide.summary,
		steps: loopGuide.steps,
		rules: loopGuide.rules.filter((rule) =>
			[
				'Built-in loops cover feature, fix, bug-fix, regression-prevention, refactor, and visual-change work.',
				'Choose bug-fix for failing-test-first repairs; choose regression-prevention for root-cause repairs with enforced guards.',
			'Agents perform retries; Harness evaluators do not launch an AI runner or automatically complete steps.',
			'Normal tests, browser checks, audit, build, and deployment proof remain source of truth.'
			].includes(rule)
		),
		antiPatterns: loopGuide.antiPatterns,
		exampleCommands: loopGuide.exampleCommands.filter((command) =>
			[
				'harness loop search feature',
				'harness loop create newsletter-signup --from feature --goal "Visitors can subscribe"',
				'harness loop evaluate newsletter-signup'
			].includes(command)
		)
	};

	expect(output.topic).toBe('loop');
	expect(output.steps).toHaveLength(5);
	expect(output.rules).toHaveLength(4);
	expect(output.antiPatterns).toHaveLength(2);
	expect(output.exampleCommands).toHaveLength(3);
	recordExampleCases(
		{
			unitId: 'guide.loop',
			symbol: 'loopGuide',
			state: 'provides-loop-workflow-guidance',
			evidence: 'examples-cases',
			file: 'provides-loop-workflow-guidance.json'
		},
		[
			{
				name: 'summarizes the loop workflow guidance',
				input: {},
				output
			}
		]
	);
});
