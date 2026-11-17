import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { unitGuides } from '../../src/guides/development-tooling/units';

function guideFor(topic: string) {
	return unitGuides.find((guide) => guide.topic === topic);
}

function summarise(guide: ReturnType<typeof guideFor>) {
	if (!guide) {
		return null;
	}
	return {
		topic: guide.topic,
		summary: guide.summary,
		stepCount: guide.steps.length,
		ruleCount: guide.rules.length,
		antiPatternCount: guide.antiPatterns.length,
		exampleCommandCount: guide.exampleCommands.length,
		firstStep: guide.steps[0],
		firstCommand: guide.exampleCommands[0]
	};
}

test('Finds the unit topic guide', () => {
	const guide = guideFor('unit');
	const output = summarise(guide);
	expect(guide?.topic).toBe('unit');
	expect(output?.summary).toBe(
		'A unit is one responsibility with a stable identity, owned source and a contract.'
	);
	expect(output?.stepCount).toBe(8);
	expect(output?.ruleCount).toBe(13);
	expect(output?.antiPatternCount).toBe(3);
	expect(output?.exampleCommandCount).toBe(10);
	recordExampleCases(
		{
			unitId: 'guide.units',
			symbol: 'unitGuides',
			state: 'finds-the-unit-topic-guide',
			evidence: 'examples-cases',
			file: 'finds-the-unit-topic-guide.json'
		},
		[{ name: 'unit topic', input: { topic: 'unit' }, output }]
	);
});

test('Returns no guide for an unknown topic', () => {
	const guide = guideFor('billing');
	const output = summarise(guide);
	expect(guide).toBeUndefined();
	expect(output).toBeNull();
	recordExampleCases(
		{
			unitId: 'guide.units',
			symbol: 'unitGuides',
			state: 'returns-no-guide-for-an-unknown-topic',
			evidence: 'examples-cases',
			file: 'returns-no-guide-for-an-unknown-topic.json'
		},
		[{ name: 'unknown topic', input: { topic: 'billing' }, output }]
	);
});
