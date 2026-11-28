import { expect, test } from 'vitest';
import {
	trackerPersonalAgent,
	trackerNonWorkAgent
} from '../../../src/utils/projects-sessions/trackerUnattendedHold';
import { trackerRepeatLabel } from '../../../src/utils/projects-sessions/trackerRepeatLabel';

test('a schedule is named by how often it repeats', () => {
	const named = ['@daily', '30 8 * * *', '0 10 * * 0', '0 10 * * sun', '0 9 3 * *'];
	expect(named.map(trackerRepeatLabel)).toEqual(['Daily', 'Daily', 'Weekly', 'Weekly', 'Monthly']);
	expect(['0 10 * * 1,4', '*/5 * * * *', '0 9 3 6 *'].map(trackerRepeatLabel)).toEqual([
		'Repeats',
		'Repeats',
		'Repeats'
	]);
	expect(trackerRepeatLabel(null)).toBeNull();
});

test('personal and family agents are personal; Chief of Staff and projects are not', () => {
	expect(['personal', 'Personal-errands', 'dad', 'family'].every(trackerPersonalAgent)).toBe(true);
	expect(['cos', 'harness', 'dadbot', 'personalize', null].some(trackerPersonalAgent)).toBe(false);
	expect(trackerNonWorkAgent('personal')).toBe(true);
});
