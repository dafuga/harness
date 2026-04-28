import { expect, test } from 'vitest';
import { findGuide } from '../src/guides/guide';

test('model guidance is available for agents', () => {
	const guide = findGuide('model');

	expect(guide?.topic).toBe('model');
	expect(guide?.exampleCommands[0]).toContain('frame generate model');
});
