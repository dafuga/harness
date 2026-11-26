import { expect, test } from 'vitest';
import { TrackerNoteAdapter } from '../../../src/adapters/agents-providers/TrackerNoteAdapter';

test('TrackerNoteAdapter lists only open, non-sensitive items of its agent', async () => {
	const calls: (readonly string[])[] = [];
	const row = (id: string, extra: object = {}) => ({
		...{ id, title: id, agent: 'demo', status: 'open' },
		...extra
	});
	const tracker = new TrackerNoteAdapter({
		agent: 'demo',
		run: async (args) => {
			calls.push(args);
			return JSON.stringify([
				row('aaaaaa1234'),
				row('bbbbbb', { status: 'done' }),
				row('cccccc', { sensitive: true }),
				row('dddddd', { agent: 'other' })
			]);
		}
	});
	await expect(tracker.openItems()).resolves.toEqual([{ id: 'aaaaaa', title: 'aaaaaa1234' }]);
	await tracker.note('aaaaaa', 'QA comment');
	expect(calls.at(-1)).toEqual(['note', 'aaaaaa', 'QA comment']);
	await expect(tracker.note('--help', 'x')).rejects.toThrow('Invalid tracker item id');
	await expect(tracker.note('aaaaaa', '--flag')).rejects.toThrow('Invalid tracker note');
});
