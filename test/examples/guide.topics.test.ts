import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import {
	availableGuideTopics,
	findGuideByTopic
} from '../../src/guides/development-tooling/topics';
import type { TopicEntry } from '../../src/guides/development-tooling/topics.types';

const guides: TopicEntry[] = [{ topic: 'page' }, { topic: 'scaffolds' }];

test('Lists distinct guide topics in first-seen order', () => {
	const entries: TopicEntry[] = [{ topic: 'page' }, { topic: 'scaffolds' }, { topic: 'page' }];
	const output = availableGuideTopics(entries);
	const empty = availableGuideTopics([]);
	expect(output).toEqual(['page', 'scaffolds']);
	expect(empty).toEqual([]);
	expect(entries).toHaveLength(3);

	recordExampleCases(
		{
			unitId: 'guide.topics',
			symbol: 'availableGuideTopics',
			state: 'lists-distinct-guide-topics-in-first-seen-order',
			evidence: 'examples-cases',
			file: 'lists-distinct-guide-topics-in-first-seen-order.json'
		},
		[
			{ name: 'collects topics in first-seen order', input: entries, output },
			{ name: 'returns an empty array for no entries', input: [], output: empty }
		]
	);
});

test('Finds a guide by a normalized or alternate topic', () => {
	const lookups: Array<[string, string]> = [
		['page', 'page'],
		['Pages', 'page'],
		['scaffold', 'scaffolds']
	];
	const cases = lookups.map(([topic, expected]) => {
		const output = findGuideByTopic(guides, topic);
		expect(output).toBe(guides.find((guide) => guide.topic === expected));
		return {
			name: `finds ${JSON.stringify(topic)} as ${expected}`,
			input: { guides, topic },
			output
		};
	});

	recordExampleCases(
		{
			unitId: 'guide.topics',
			symbol: 'findGuideByTopic',
			state: 'finds-a-guide-by-a-normalized-or-alternate-topic',
			evidence: 'examples-cases',
			file: 'finds-a-guide-by-a-normalized-or-alternate-topic.json'
		},
		cases
	);
});

test('Returns undefined when no guide matches the topic', () => {
	const missing = findGuideByTopic(guides, 'missing');
	const none = findGuideByTopic([], 'page');
	expect(missing).toBeUndefined();
	expect(none).toBeUndefined();

	recordExampleCases(
		{
			unitId: 'guide.topics',
			symbol: 'findGuideByTopic',
			state: 'returns-undefined-when-no-guide-matches-the-topic',
			evidence: 'examples-cases',
			file: 'returns-undefined-when-no-guide-matches-the-topic.json'
		},
		[
			{
				name: 'unknown topic finds nothing',
				input: { guides, topic: 'missing' },
				output: { found: missing !== undefined }
			},
			{
				name: 'empty guide list finds nothing',
				input: { guides: [], topic: 'page' },
				output: { found: none !== undefined }
			}
		]
	);
});
