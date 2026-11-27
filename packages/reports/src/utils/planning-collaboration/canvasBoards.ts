// @harness-uid u_jsmh4lfzmp
import type { CanvasBoard, CanvasManifest } from './designCanvas.types';
import { artboardPresets, artboardSize } from './artboardSize';
import { maxArtboardBytes } from './canvasManifest';

export const boardGap = 80;

/**
 * Places a canvas's artboards. One with its own `x` and `y` stays there; the rest follow in
 * manifest order in a row to the right of everything placed by hand.
 */
export function canvasBoards(
	manifest: CanvasManifest,
	sources: ReadonlyMap<string, string>
): CanvasBoard[] {
	const read = manifest.artboards.map((entry) => ({
		...entry,
		...source(sources.get(entry.file))
	}));
	const placed = read.filter((board) => board.x !== undefined);
	let next = Math.max(0, ...placed.map((board) => board.x! + board.width + boardGap));
	return read.map((board) => {
		if (board.x !== undefined) return { ...board, x: board.x, y: board.y! };
		const x = next;
		next += board.width + boardGap;
		return { ...board, x, y: 0 };
	});
}

function source(html: string | undefined) {
	const size = html === undefined ? null : artboardSize(html);
	const problem = problemOf(html, size !== null);
	return {
		...(size ?? artboardPresets.desktop),
		html: problem && !size ? '' : (html ?? ''),
		problem
	};
}

function problemOf(html: string | undefined, sized: boolean): string | null {
	if (html === undefined) return 'The artboard file is missing.';
	if (html.length > maxArtboardBytes) return 'The artboard file is larger than 512 KB.';
	return sized ? null : 'The artboard declares no usable artboard-size.';
}
