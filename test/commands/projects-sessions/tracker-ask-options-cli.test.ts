import { expect, test } from 'vitest';
import { nativeTrackerArgs } from '../../../src/commands/projects-sessions/tracker-command/nativeTrackerRequest';

test('flag and answer carry multiple-choice options', () => {
	const flagged = nativeTrackerArgs([
		'flag',
		'abc123',
		'Deploy now?',
		'--option',
		'Deploy=Ship to production',
		'--option',
		'Hold=Wait a day',
		'--recommend',
		'2',
		'--confirm',
		'deploy'
	]).request;
	expect(flagged).toEqual({
		method: 'POST',
		path: '/items/abc123/flag',
		body: {
			question: 'Deploy now?',
			force: undefined,
			options: [
				{ label: 'Deploy', effect: 'Ship to production' },
				{ label: 'Hold', effect: 'Wait a day', recommended: true }
			],
			confirm: 'deploy'
		}
	});
	expect(() => nativeTrackerArgs(['flag', 'abc123', 'Q?', '--option', 'Only'])).toThrow('2 to 4');
	expect(() => nativeTrackerArgs(['flag', 'abc123', 'Q?', '--recommend', '1'])).toThrow(
		'needs --option'
	);
	expect(
		nativeTrackerArgs(['answer', 'abc123', '--option', '2', '--confirmed', '--by', 'Daniel'])
			.request.body
	).toMatchObject({ option: '2', confirmed: true, by: 'Daniel' });
});

test('reject sends its words as the reason and works without one', () => {
	expect(nativeTrackerArgs(['reject', 'abc123', 'wrong', 'approach']).request).toEqual({
		method: 'POST',
		path: '/items/abc123/reject',
		body: { reason: 'wrong approach' }
	});
	expect(nativeTrackerArgs(['reject', 'abc123']).request.body).toEqual({ reason: '' });
});
