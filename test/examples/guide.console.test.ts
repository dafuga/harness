import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { consoleGuides } from '../../src/guides/development-tooling/console';

test('Exports the console and edge guides', () => {
	const output = consoleGuides.map((guide) => ({
		topic: guide.topic,
		summary: guide.summary,
		stepCount: guide.steps.length,
		ruleCount: guide.rules.length,
		antiPatterns: guide.antiPatterns,
		exampleCommands: guide.exampleCommands
	}));
	expect(output.map((guide) => guide.topic)).toEqual(['console', 'edge']);
	recordExampleCases(
		{
			unitId: 'guide.console',
			symbol: 'consoleGuides',
			state: 'exports-the-console-and-edge-guides',
			evidence: 'examples-cases',
			file: 'exports-the-console-and-edge-guides.json'
		},
		[{ name: 'console and edge guide summaries', input: null, output }]
	);
});
