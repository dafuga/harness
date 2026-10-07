import { expect, test } from 'vitest';
import { replayFrames } from '../../src/utils/replayFrames';
import type { Evidence } from '../../src/models/Report.types';
const frame = (id: string, order: number, extra: Partial<Evidence> = {}): Evidence => ({
	id,
	title: `Scene ${order} — ${id}`,
	category: 'Gameplay',
	file: `${id}.jpg`,
	order,
	status: 'passed',
	...extra
});
test('replay preserves chronological screenshots and omits non-playable evidence', () => {
	const items = [
		frame('later', 2),
		frame('first', 1),
		frame('expired', 3, { missing: true }),
		frame('audio', 4, { mediaType: 'audio' }),
		frame('before', 5, { phase: 'before' })
	];
	expect(replayFrames(items).map((f) => f.item.id)).toEqual(['first', 'later']);
	expect(replayFrames(items).map((f) => f.scene)).toEqual([1, 2]);
});
test('live appended frames retain the previous sequence and input is never mutated', () => {
	const original = [frame('one', 1), frame('two', 2)];
	const previous = JSON.stringify(original);
	expect(replayFrames([...original, frame('three', 3)]).slice(0, 2)).toEqual(
		replayFrames(original)
	);
	expect(JSON.stringify(original)).toBe(previous);
});
