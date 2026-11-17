import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { historyGuides } from '../../src/guides/git-source-history/history';

test('Exposes the history hooks and CI guides', () => {
	const output = historyGuides.map((guide) => ({
		topic: guide.topic,
		summary: guide.summary,
		stepCount: guide.steps.length,
		ruleCount: guide.rules.length,
		antiPatternCount: guide.antiPatterns.length,
		exampleCommands: guide.exampleCommands
	}));
	expect(output.map((guide) => guide.topic)).toEqual(['history', 'hooks', 'ci']);
	expect(output[2]).toMatchObject({
		topic: 'ci',
		summary: 'CI verifies code without write access and publishes evidence from trusted code.',
		stepCount: 3
	});
	recordExampleCases(
		{
			unitId: 'guide.history',
			symbol: 'historyGuides',
			state: 'exposes-the-history-hooks-and-ci-guides',
			evidence: 'examples-cases',
			file: 'exposes-the-history-hooks-and-ci-guides.json'
		},
		[{ name: 'three ordered static guides', input: {}, output }]
	);
});
