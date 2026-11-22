import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { tooltipPlace } from '../../src/utils/explorer-ui/tooltipPlace';
import type { TooltipMark, TooltipSize } from '../../src/utils/explorer-ui/tooltipPlace';

type Cases = Parameters<typeof recordExampleCases>[1];
const unitId = 'reports.function.tooltip-place';
const record = (state: string, cases: Cases) =>
	recordExampleCases(
		{ unitId, symbol: 'tooltipPlace', state, evidence: 'examples-cases', file: `${state}.json` },
		cases
	);

const phone: TooltipSize = { width: 390, height: 844 };
const tip: TooltipSize = { width: 240, height: 80 };
const mark = (left: number, top: number, height = 32): TooltipMark => ({
	left,
	top,
	width: 32,
	height
});

/** Calls the public entry and returns its result with the arguments it was given. */
function place(name: string, anchor: TooltipMark, size: TooltipSize, view: TooltipSize) {
	return {
		name,
		input: { mark: anchor, tip: size, view },
		output: tooltipPlace(anchor, size, view)
	};
}

test('Places the tooltip below its mark, centred, with the 8-pixel gap', () => {
	const below = place('centred under a mark', mark(180, 100), tip, phone);
	expect(below.output).toEqual({ left: 76, top: 140 });
	record('places-below-centred-with-the-gap', [below]);
});

test('Clamps the tooltip to the screen edges when it fits', () => {
	const leftEdge = place('mark at the left edge', mark(4, 100), tip, phone);
	const rightEdge = place('mark at the right edge', mark(354, 100), tip, phone);
	expect(leftEdge.output).toEqual({ left: 8, top: 140 });
	expect(rightEdge.output).toEqual({ left: 142, top: 140 });
	record('clamps-to-the-screen-edges', [leftEdge, rightEdge]);
});

test('An overwide tooltip starts at the margin and is not made to fit', () => {
	const wide: TooltipSize = { width: 500, height: 80 };
	const overwide = place('wider than the screen', mark(180, 100), wide, phone);
	expect(overwide.output).toEqual({ left: 8, top: 140 });
	expect(overwide.output.left + wide.width).toBeGreaterThan(phone.width);
	record('overwide-tooltip-starts-at-the-margin', [overwide]);
});

test('Opens above the mark when there is no room below', () => {
	const above = place('mark near the bottom', mark(180, 800), tip, phone);
	expect(above.output).toEqual({ left: 76, top: 712 });
	record('opens-above-without-room-below', [above]);
});

test('A tooltip exactly as tall as the room on one side fits without a height', () => {
	const exactBelow = place(
		'exactly the room below',
		mark(180, 100),
		{ width: 240, height: 696 },
		phone
	);
	const oneTallerBelow = place(
		'one pixel over the room below',
		mark(180, 100),
		{ width: 240, height: 697 },
		phone
	);
	const exactAbove = place(
		'exactly the room above',
		mark(180, 800),
		{ width: 240, height: 784 },
		phone
	);
	expect(exactBelow.output).toEqual({ left: 76, top: 140 });
	expect(oneTallerBelow.output).toEqual({ left: 76, top: 140, height: 696 });
	expect(exactAbove.output).toEqual({ left: 76, top: 8 });
	record('exact-fit-uses-no-height', [exactBelow, oneTallerBelow, exactAbove]);
});

test('A tooltip taller than both sides takes the roomier side below and its height', () => {
	const roomierBelow = place(
		'taller than both sides',
		mark(180, 40),
		{ width: 240, height: 820 },
		phone
	);
	expect(roomierBelow.output).toEqual({ left: 76, top: 80, height: 756 });
	record('takes-the-roomier-side-below', [roomierBelow]);
});

test('On a tie between the two sides the tooltip goes below with that room as height', () => {
	const tied = place(
		'equal room above and below',
		mark(180, 100),
		{ width: 240, height: 200 },
		{ width: 390, height: 232 }
	);
	expect(tied.output).toEqual({ left: 76, top: 140, height: 84 });
	record('tie-prefers-the-side-below', [tied]);
});

test('On a short screen a tooltip takes the roomier side above, starting at the gap', () => {
	const short = place(
		'short screen, more room above',
		mark(180, 250),
		{ width: 240, height: 600 },
		{ width: 390, height: 320 }
	);
	expect(short.output).toEqual({ left: 76, top: 8, height: 234 });
	record('short-screen-takes-the-roomier-side-above', [short]);
});
