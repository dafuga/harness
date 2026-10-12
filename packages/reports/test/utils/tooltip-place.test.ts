import { expect, test } from 'vitest';
import { tooltipPlace } from '../../src/utils/tooltipPlace';

const view = { width: 390, height: 844 };
const tip = { width: 240, height: 80 };
const mark = (left: number, top: number) => ({ left, top, width: 32, height: 32 });

test('a tooltip sits under its mark, centred on it, with the gap a pointer can cross', () => {
	expect(tooltipPlace(mark(180, 100), tip, view)).toEqual({ left: 76, top: 140 });
});

test('near an edge of the screen it stays wholly on the screen instead of centring', () => {
	expect(tooltipPlace(mark(4, 100), tip, view).left).toBe(8);
	expect(tooltipPlace(mark(354, 100), tip, view).left).toBe(390 - 240 - 8);
	// One wider than the screen starts at the margin; its own width is limited by its style.
	expect(tooltipPlace(mark(180, 100), { width: 500, height: 80 }, view).left).toBe(8);
});

test('with no room under the mark it opens above it', () => {
	expect(tooltipPlace(mark(180, 800), tip, view)).toEqual({ left: 76, top: 800 - 8 - 80 });
});

test('taller than the room on either side, it takes the larger side and its height, to scroll inside', () => {
	// Under a mark near the top of a phone there are 756 pixels, above it 24.
	expect(tooltipPlace(mark(180, 40), { width: 240, height: 820 }, view)).toEqual({
		left: 76,
		top: 80,
		height: 756
	});
	// Above a mark low on a short screen there is more room than under it.
	const short = { width: 390, height: 320 };
	expect(tooltipPlace(mark(180, 250), { width: 240, height: 600 }, short)).toEqual({
		left: 76,
		top: 8,
		height: 234
	});
	// Whatever its height, it never leaves the screen.
	for (const top of [0, 40, 150, 250, 288]) {
		const placed = tooltipPlace(mark(180, top), { width: 240, height: 600 }, short);
		expect([top, placed.top >= 8, placed.top + (placed.height ?? 600) <= 320 - 8]).toEqual([
			top,
			true,
			true
		]);
	}
});
