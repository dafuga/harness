import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import {
	guides,
	findGuide,
	availableGuideTopics
} from '../../src/guides/development-tooling/guide';
import type { Guide } from '../../src/guides/development-tooling/guide.types';

function summary(guide: Guide | undefined) {
	if (!guide) return undefined;
	return {
		topic: guide.topic,
		summary: guide.summary,
		steps: guide.steps,
		rules: guide.rules,
		antiPatterns: guide.antiPatterns,
		exampleCommands: guide.exampleCommands
	};
}

test('Exposes assembled guide guidance', () => {
	const guide = guides.find((item) => item.topic === 'model');
	expect(guide).toMatchObject({
		topic: 'model',
		summary: 'Add data behavior through a small ActiveRecord-like model and an adapter.'
	});
	recordExampleCases(
		{
			unitId: 'guide.guide',
			symbol: 'guides',
			state: 'exposes-assembled-guide-guidance',
			evidence: 'examples-cases',
			file: 'exposes-assembled-guide-guidance.json'
		},
		[{ name: 'model guidance', input: { topic: 'model' }, output: summary(guide) }]
	);
});

test('Finds guidance by topic', () => {
	const topics = ['controller', 'component'] as const;
	const cases = topics.map((topic) => {
		const result = findGuide(topic);
		expect(result?.topic).toBe(topic);
		return { name: `finds ${topic}`, input: { topic }, output: summary(result) };
	});
	recordExampleCases(
		{
			unitId: 'guide.guide',
			symbol: 'findGuide',
			state: 'finds-guidance-by-topic',
			evidence: 'examples-cases',
			file: 'finds-guidance-by-topic.json'
		},
		cases
	);
});

test('Lists available guide topics', () => {
	const topics = availableGuideTopics();
	expect(topics).toEqual(expect.arrayContaining(['model', 'controller', 'component']));
	recordExampleCases(
		{
			unitId: 'guide.guide',
			symbol: 'availableGuideTopics',
			state: 'lists-available-guide-topics',
			evidence: 'examples-cases',
			file: 'lists-available-guide-topics.json'
		},
		[{ name: 'assembled unique topics', input: {}, output: topics }]
	);
});
