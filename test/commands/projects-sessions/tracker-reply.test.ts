import { expect, test } from 'vitest';
import {
	nativeTrackerArgs,
	nativeTrackerCommands
} from '../../../src/commands/projects-sessions/tracker-command/nativeTrackerRequest';

test('tracker reply answers one Hub message by its id', () => {
	expect(nativeTrackerCommands.split(', ')).toContain('reply');
	expect(
		nativeTrackerArgs(['reply', 'abcdefgh23-1a2b3c4d', 'Merged,', 'see', '#12']).request
	).toEqual({
		method: 'POST',
		path: '/messages/abcdefgh23-1a2b3c4d/reply',
		body: { text: 'Merged, see #12' }
	});
	expect(() => nativeTrackerArgs(['reply', 'abcdefgh23-1a2b3c4d'])).toThrow(
		'usage: tracker reply <message id> <text...>'
	);
});
