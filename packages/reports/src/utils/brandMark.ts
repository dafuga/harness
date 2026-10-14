/**
 * The Harness mark, a modular H: five equal square tiles on a 32-unit grid, at the four corners
 * and the centre of a 3 by 3 lattice, with gaps a tenth of a tile. Every surface draws this.
 */
export const brandGrid = 32;
const size = 10;
const step = 11;
export const brandTiles = [
	[0, 0],
	[2, 0],
	[1, 1],
	[0, 2],
	[2, 2]
].map(([column, row], index) => ({ id: index, x: column * step, y: row * step, size }));
export const brandColors = { gold: '#f2bf3f', navy: '#0b1a37' };

/** The mark as a standalone SVG, gold tiles on a navy rounded square: the favicon of every app. */
export function brandMark(): string {
	const tiles = brandTiles
		.map(
			(tile) =>
				`<rect x="${tile.x + 10}" y="${tile.y + 10}" width="${tile.size}" height="${tile.size}" fill="${brandColors.gold}"/>`
		)
		.join('');
	const plate = `<rect width="52" height="52" rx="10" fill="${brandColors.navy}"/>`;
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52">${plate}${tiles}</svg>`;
}
