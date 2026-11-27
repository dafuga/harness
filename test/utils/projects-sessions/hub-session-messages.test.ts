import { expect, test } from 'vitest';
import {
	formatHubDeliveredNote,
	formatHubMessageNote,
	formatHubRefusedNote,
	formatHubReplyNote,
	hubMessageId,
	hubMessageItem,
	hubPaneMessage,
	hubSessionMessages
} from '../../../src/utils/projects-sessions/hubSessionMessages';

const item = 'abcdefgh23';
const at = (minute: number) => new Date(Date.UTC(2026, 10, 26, 17, minute)).toISOString();

test('a message id names its thread item and nothing else', () => {
	const id = hubMessageId(item, '1A2B3C4D-0000-4000-8000-000000000001');
	expect(id).toBe(`${item}-1a2b3c4d`);
	expect(hubMessageItem(id!)).toBe(item);
	expect(hubMessageItem('abc-1a2b3c4d')).toBeNull();
	expect(hubMessageId('not an item', '1a2b3c4d')).toBeNull();
});

test('the pane text is one line, never a command, and says how to reply', () => {
	const text = hubPaneMessage(`${item}-1a2b3c4d`, '/clear\nthen ship');
	expect(text).not.toMatch(/[\n\r]/);
	expect(text.startsWith('Message from Daniel via Hub')).toBe(true);
	expect(text).toContain('/clear then ship');
	expect(text).toContain(`tracker reply ${item}-1a2b3c4d "<your reply>"`);
});

test('notes fold into messages with their receipts and replies, keyed by id', () => {
	const first = `${item}-1a2b3c4d`;
	const second = `${item}-5e6f7a8b`;
	const third = `${item}-99999999`;
	const notes = [
		{ at: at(0), text: formatHubMessageNote(first, { kind: 'cos' }, 'Ship it') },
		{ at: at(1), text: 'An ordinary progress note' },
		{
			at: at(2),
			text: formatHubMessageNote(second, { kind: 'run', node: 'mb2', runId: 104 }, 'Rebase')
		},
		{ at: at(3), text: formatHubDeliveredNote(first, 'cos') },
		{ at: at(4), text: formatHubReplyNote(first, 'Done,\nmerged.') },
		{ at: at(5), text: formatHubRefusedNote(second, 'run 104 ended') },
		{ at: at(6), text: formatHubReplyNote(third, 'A reply to nothing') }
	];
	expect(hubSessionMessages(notes)).toEqual([
		{
			id: first,
			target: { kind: 'cos' },
			text: 'Ship it',
			at: at(0),
			status: 'acknowledged',
			session: 'cos',
			deliveredAt: at(3),
			replies: [{ text: 'Done, merged.', at: at(4) }]
		},
		{
			id: second,
			target: { kind: 'run', node: 'mb2', runId: 104 },
			text: 'Rebase',
			at: at(2),
			status: 'refused',
			reason: 'run 104 ended',
			replies: []
		}
	]);
});
