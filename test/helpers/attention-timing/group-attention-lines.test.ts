import { expect, test } from 'vitest';
import { groupAttentionLines } from '../../../src/helpers/attention-timing/groupAttentionLines';

const line = (kind: string, itemId: string, atMs: number) => ({ kind, itemId, atMs });

test('groupAttentionLines keeps the newest line per item and kind', () => {
	const batch = groupAttentionLines([
		line('needs_daniel', 'a', 100),
		line('needs_daniel', 'a', 300),
		line('needs_daniel', 'a', 200)
	]);
	expect(batch.lines).toEqual([line('needs_daniel', 'a', 300)]);
});

test('groupAttentionLines orders needs-Daniel, launch waits, blocked, then done, and by time within a kind', () => {
	const batch = groupAttentionLines([
		line('done', 'd', 1),
		line('blocked', 'b', 5),
		line('needs_daniel', 'n2', 9),
		line('needs_daniel', 'n1', 2),
		line('launch_wait', 'l', 3)
	]);
	expect(batch.lines.map((l) => `${l.kind}:${l.itemId}`)).toEqual([
		'needs_daniel:n1',
		'needs_daniel:n2',
		'launch_wait:l',
		'blocked:b',
		'done:d'
	]);
});

test('groupAttentionLines counts each kind, with zero for kinds not present', () => {
	const batch = groupAttentionLines([
		line('blocked', 'b', 1),
		line('done', 'd', 2),
		line('done', 'e', 3)
	]);
	expect(batch.counts).toEqual({ needs_daniel: 0, blocked: 1, done: 2 });
});

test('groupAttentionLines of nothing is an empty batch', () => {
	expect(groupAttentionLines([])).toEqual({
		lines: [],
		counts: { needs_daniel: 0, blocked: 0, done: 0 }
	});
});
