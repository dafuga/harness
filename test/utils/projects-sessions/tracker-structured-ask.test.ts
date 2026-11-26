import { expect, test } from 'vitest';
import {
	trackerFlagKind,
	trackerStructuredAsk
} from '../../../src/utils/projects-sessions/trackerStructuredAsk';

const options = [{ label: 'Ship', recommended: true }, { label: 'Wait' }];
const ask = {
	needs_daniel: 1,
	resolved: 0,
	status: 'in_progress',
	question: 'Ship it?',
	options
};

test('a question with 2 to 4 choices and one recommendation is a structured ask', () => {
	expect(trackerStructuredAsk(ask)).toBe(true);
	expect(trackerStructuredAsk({ ...ask, options: JSON.stringify(options) })).toBe(true);
	// A finished or blocked item keeps its unanswered decision.
	expect(trackerStructuredAsk({ ...ask, status: 'done' })).toBe(true);
	expect(trackerStructuredAsk({ ...ask, status: 'blocked' })).toBe(true);
});

test('a closed, answered or ignored flag is nothing', () => {
	for (const change of [{ needs_daniel: 0 }, { resolved: 1 }, { status: 'ignored' }])
		expect(trackerFlagKind({ ...ask, ...change })).toBeNull();
});

test('a flag without answerable choices goes to Chief of Staff as needs options', () => {
	for (const change of [
		{ options: null },
		{ options: 'not json' },
		{ options: [options[0]] },
		{ options: [...options, ...options, options[1]] },
		{ options: [{ label: 'Ship' }, { label: 'Wait' }] },
		{ options: [options[0], options[0]] },
		{ options: [options[0], { label: ' ' }] },
		{ question: '  ' }
	])
		expect(trackerFlagKind({ ...ask, ...change })).toBe('needs-options');
});

test('a watchdog ping is a ping even with choices', () => {
	const question = 'Session auto-x is idle again after a watchdog check-in.';
	expect(trackerFlagKind({ ...ask, question })).toBe('ping');
});
