import { expect, test } from 'vitest';
import { trackerHandSession } from '../../../src/utils/projects-sessions/trackerSessionNames';

const item = {
	id: 'abc123def4',
	title: 'Fix the   report export',
	owner: 'report session',
	project: 'harness',
	agent: null
};
const window = (session: string, name: string) => ({ session, window: name });

test.each([
	['the full item id', window('abc123def4', 'zsh')],
	['the short id as a window name', window('work', 'abc123')],
	['the owner', window('Report  Session', 'zsh')],
	['a "Project: title" window', window('0', 'Harness: Fix the report export')]
])('a hand-launched session named by %s counts as open', (_label, open) => {
	expect(trackerHandSession([open], item)).toBe(true);
});

test('managed run panes and ordinary shell names never hold an item', () => {
	const managed = window('auto-abc123-r4', 'Harness: Fix the report export');
	expect(trackerHandSession([managed], item)).toBe(false);
	expect(trackerHandSession([window('0', 'claude')], { ...item, owner: 'claude' })).toBe(false);
	expect(trackerHandSession([window('cos', 'zsh')], { ...item, owner: 'cos' })).toBe(false);
});
