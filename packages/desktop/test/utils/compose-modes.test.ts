import { expect, test } from 'vitest';
import {
	composeModes,
	defaultDesignCount,
	designCounts,
	visualCategory
} from '../../src/utils/composeModes';
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

test('only pages, shells and components plan images, from one to ten options, three by default', () => {
	expect(['pages', 'shells', 'components'].map(visualCategory)).toEqual([true, true, true]);
	expect(['functions', 'configs', 'services'].map(visualCategory)).toEqual([false, false, false]);
	expect([designCounts[0], designCounts.at(-1), designCounts.length]).toEqual([1, 10, 10]);
	expect(defaultDesignCount).toBe(3);
});
