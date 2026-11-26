import { expect, test } from 'vitest';
import { nativeTrackerArgs } from '../../../src/commands/projects-sessions/tracker-command/nativeTrackerRequest';

const choices = ['--option', 'Ship=Releases today.', '--option', 'Wait=Holds a day.'];

test('tracker flag is refused without choices and a recommendation', () => {
	for (const extra of [[], choices, ['--recommend', '1']])
		expect(() => nativeTrackerArgs(['flag', 'abc123', 'Ship it?', ...extra])).toThrow(
			/tracker flag needs choices|--recommend needs --option/
		);
});

test('the recommendation is a number or its letter', () => {
	for (const word of ['2', 'B', 'b'])
		expect(
			nativeTrackerArgs(['flag', 'abc123', 'Ship it?', ...choices, '--recommend', word]).request
				.body
		).toMatchObject({ options: [{ label: 'Ship' }, { label: 'Wait', recommended: true }] });
});

test('a message for Chief of Staff needs no choices', () => {
	const { request } = nativeTrackerArgs(['flag', 'abc123', 'CoS: please publish the canvas.']);
	expect(request.body).toMatchObject({ question: 'CoS: please publish the canvas.' });
});

test('tracker block records a blocker without asking Daniel unless told to', () => {
	const { request } = nativeTrackerArgs(['block', 'abc123', 'waiting on d3jma2']);
	expect(request.body).toMatchObject({ reason: 'waiting on d3jma2', needs_daniel: false });
});
