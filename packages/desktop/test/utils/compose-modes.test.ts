import { expect, test } from 'vitest';
import { composeModes } from '../../src/utils/composeModes';
import type { ProjectCapabilities } from '../../src/models/ProjectContext.types';

const local: ProjectCapabilities = {
	comments: true,
	agents: true,
	planning: true,
	approval: true,
	source: 'local'
};
const hosted: ProjectCapabilities = {
	comments: true,
	agents: false,
	planning: false,
	approval: false,
	source: 'github'
};

test('Comment leads wherever people may comment', () => {
	expect(composeModes(local, true)).toEqual(['comment', 'plan', 'change']);
	expect(composeModes(hosted, true)).toEqual(['comment']);
});

test('Plan and Change need agents and a writable tip', () => {
	expect(composeModes(local, false)).toEqual(['comment']);
	expect(composeModes(hosted, false)).toEqual(['comment']);
	expect(composeModes({ ...local, comments: false }, true)).toEqual(['plan', 'change']);
});

test('a context that allows nothing offers no mode', () => {
	expect(composeModes({ ...hosted, comments: false }, true)).toEqual([]);
	expect(composeModes({ ...local, comments: false }, false)).toEqual([]);
});
