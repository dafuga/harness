import { expect, test } from 'vitest';
import { availableGuideTopics, findGuide, guides } from '../src/guides/guide';
import { scaffoldKinds } from '../src/templates/scaffoldTypes';

test('model guidance is available for agents', () => {
	const guide = findGuide('model');

	expect(guide?.topic).toBe('model');
	expect(guide?.exampleCommands[0]).toContain('frame generate model');
});

test('guidance covers every non-model scaffold topic', () => {
	const topics = new Set(guides.map((guide) => guide.topic));

	for (const kind of scaffoldKinds) {
		expect(topics.has(kind), kind).toBe(true);
	}
});

test('code-rules guidance exposes hard Frame limits', () => {
	const guide = findGuide('code-rules');

	expect(guide?.rules.join('\n')).toContain('Functions stay at or below 55 lines');
	expect(guide?.rules.join('\n')).toContain('Classes stay at or below 120 lines');
});

test('scaffold guidance tells agents what generated code contains', () => {
	const catalog = findGuide('scaffolds');
	const mailer = findGuide('mailer');

	expect(catalog?.rules.join('\n')).toContain('mailer: Email rendering');
	expect(mailer?.contains?.join('\n')).toContain('Mailer class under src/mailers');
	expect(mailer?.exampleCommands[0]).toBe('frame generate mailer example');
});

test('guide lookup accepts common scaffold aliases', () => {
	expect(findGuide('scaffold')?.topic).toBe('scaffolds');
	expect(findGuide('controllers')?.topic).toBe('controller');
	expect(findGuide('policies')?.topic).toBe('policy');
	expect(findGuide('code rules')?.topic).toBe('code-rules');
});

test('available guide topics are unique for CLI error output', () => {
	const topics = availableGuideTopics();

	expect(topics).toEqual([...new Set(topics)]);
	expect(topics.filter((topic) => topic === 'controller')).toHaveLength(1);
});
