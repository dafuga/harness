import { expect, test } from 'vitest';
import { canvasManifest } from '../../../src/utils/planning-collaboration/canvasManifest';
import { boardGap, canvasBoards } from '../../../src/utils/planning-collaboration/canvasBoards';
import {
	fitView,
	fullScale,
	maxScale,
	minScale,
	zoomAt
} from '../../../src/utils/planning-collaboration/fitView';

const manifest = (artboards: unknown[], more = {}) =>
	JSON.stringify({ schemaVersion: 1, title: 'Cards', artboards, ...more });
const html = (size: string) => `<meta name="artboard-size" content="${size}">`;

test('the manifest keeps order, titles and positions', () => {
	const read = canvasManifest(
		manifest([
			{ file: 'B.html', title: 'Second letter first' },
			{ file: 'A.html', title: 'A', x: 10, y: -20 }
		])
	);
	expect(read.artboards.map((a) => a.file)).toEqual(['B.html', 'A.html']);
	expect(read.artboards[1]).toMatchObject({ x: 10, y: -20 });
});

test.each([
	['nope', /not JSON/],
	['[]', /object/],
	[manifest([], { schemaVersion: 2 }), /schemaVersion/],
	[manifest([{ file: '../secret.html', title: 'x' }]), /<Name>\.html/],
	[manifest([{ file: 'a/b.html', title: 'x' }]), /<Name>\.html/],
	[manifest([{ file: 'A.html', title: '' }]), /title/],
	[manifest([{ file: 'A.html', title: 'x', x: 1 }]), /both/],
	[
		manifest([
			{ file: 'A.html', title: 'x' },
			{ file: 'a.html', title: 'y' }
		]),
		/unique/
	]
])('refuses %s', (text, reason) => {
	expect(() => canvasManifest(text)).toThrow(reason);
});

test('unplaced boards form a row to the right of placed ones; broken ones say why', () => {
	const boards = canvasBoards(
		canvasManifest(
			manifest([
				{ file: 'Row.html', title: 'Row' },
				{ file: 'Gone.html', title: 'Gone' },
				{ file: 'Set.html', title: 'Set', x: 0, y: 50 }
			])
		),
		new Map([
			['Row.html', html('390x844')],
			['Set.html', html('1000x600')]
		])
	);
	expect(boards.map((b) => [b.x, b.y, b.width])).toEqual([
		[1000 + boardGap, 0, 390],
		[1000 + boardGap + 390 + boardGap, 0, 1440],
		[0, 50, 1000]
	]);
	expect(boards.map((b) => b.problem)).toEqual([null, 'The artboard file is missing.', null]);
});

test('zoom keeps the point under the pointer and stays within limits', () => {
	const view = { x: 100, y: 50, scale: 0.5 };
	const at = { x: 400, y: 300 };
	const next = zoomAt(view, at, 2);
	const world = (v: typeof view) => [(at.x - v.x) / v.scale, (at.y - v.y) / v.scale];
	expect(world(next)).toEqual(world(view));
	expect(zoomAt(view, at, 1000).scale).toBe(maxScale);
	expect(zoomAt(view, at, 0.00001).scale).toBe(minScale);
});

test('fit centres every board without enlarging, and full view fits one', () => {
	const boards = canvasBoards(
		canvasManifest(manifest([{ file: 'A.html', title: 'A' }])),
		new Map([['A.html', html('400x200')]])
	);
	expect(fitView(boards, { width: 1000, height: 600 })).toEqual({ scale: 1, x: 300, y: 200 });
	expect(fitView(boards, { width: 248, height: 600 }).scale).toBeLessThan(0.6);
	expect(fitView([], { width: 10, height: 10 })).toEqual({ x: 0, y: 0, scale: 1 });
	expect(fullScale({ width: 1440, height: 900 }, { width: 720, height: 900 })).toBe(0.5);
});
