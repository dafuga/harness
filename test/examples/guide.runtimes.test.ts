import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { runtimeGuides } from '../../src/guides/execution-runtimes/runtimes';

test('Lists runtime impact kernel and Rust guides', () => {
	const topics = runtimeGuides.map((guide) => guide.topic);
	expect(topics).toEqual(['runtime', 'impact', 'kernel', 'rust']);
	expect(runtimeGuides[3]).toEqual({ ...runtimeGuides[2], topic: 'rust' });
	const output = runtimeGuides.map(({ topic, summary, steps, rules, antiPatterns, exampleCommands }) => ({
		topic,
		summary,
		stepCount: steps.length,
		ruleCount: rules.length,
		antiPatternCount: antiPatterns.length,
		exampleCommandCount: exampleCommands.length
	}));
	recordExampleCases(
		{
			unitId: 'guide.runtimes',
			symbol: 'runtimeGuides',
			state: 'lists-runtime-impact-kernel-and-rust-guides',
			evidence: 'examples-cases',
			file: 'lists-runtime-impact-kernel-and-rust-guides.json'
		},
		[{ name: 'all guide topics and content sizes', input: null, output }]
	);
});
