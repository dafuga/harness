import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect } from '../../../../test/verificationExpect';
import { test } from 'vitest';
import { brandMark, brandTiles } from '../../src/utils/brandMark';

/**
 * The modular H: five equal square tiles on a 3 by 3 lattice, the four corners and the centre,
 * with gaps a tenth of a tile. Every app serves the same mark as its favicon.
 */
const packages = resolve(import.meta.dirname, '../../..');

test('five equal tiles fill the corners and centre of a square lattice', () => {
	const sizes = new Set(brandTiles.map((tile) => tile.size));
	expect(sizes.size).toBe(1);
	const [size] = sizes;
	const step = size + size / 10;
	const at = (tile: { x: number; y: number }) => [tile.x / step, tile.y / step];
	expect(brandTiles.map(at)).toEqual([
		[0, 0],
		[2, 0],
		[1, 1],
		[0, 2],
		[2, 2]
	]);
});

test('the favicon draws the five tiles in gold on a navy square', () => {
	const svg = brandMark();
	expect(svg).toMatch(/^<svg [^>]*viewBox="0 0 \d+ \d+"/);
	expect(svg.match(/<rect /g)).toHaveLength(6);
	expect(svg).toContain('fill="#0b1a37"');
	expect(svg.match(/fill="#f2bf3f"/g)).toHaveLength(5);
});

test.each(['desktop', 'hub', 'reports'])(
	'the %s app serves the shared mark as its favicon',
	(app) => {
		const served = readFileSync(resolve(packages, app, 'static/favicon.svg'), 'utf8');
		expect(served.trim()).toBe(brandMark());
		const page = readFileSync(resolve(packages, app, 'src/app.html'), 'utf8');
		expect(page).toContain(
			'<link rel="icon" type="image/svg+xml" href="%sveltekit.assets%/favicon.svg" />'
		);
	}
);
