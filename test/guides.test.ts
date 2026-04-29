import { expect, test } from 'vitest';
import { findGuide, guides } from '../src/guides/guide';
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
