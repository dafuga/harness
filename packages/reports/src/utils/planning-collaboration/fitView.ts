// @harness-uid u_mh6h42s4lx
import type { ArtboardSize, CanvasBoard, CanvasPoint, CanvasView } from './designCanvas.types';

export const minScale = 0.05;
export const maxScale = 4;
const clamp = (scale: number) => Math.min(maxScale, Math.max(minScale, scale));

/** Changes the zoom and keeps the canvas point under `at` where it is on screen. */
export function zoomAt(view: CanvasView, at: CanvasPoint, factor: number): CanvasView {
	const scale = clamp(view.scale * factor);
	const ratio = scale / view.scale;
	return { scale, x: at.x - (at.x - view.x) * ratio, y: at.y - (at.y - view.y) * ratio };
}

/** Shows every board, centred in the viewport and never enlarged past its real size. */
export function fitView(boards: readonly CanvasBoard[], viewport: ArtboardSize): CanvasView {
	if (!boards.length) return { x: 0, y: 0, scale: 1 };
	const left = Math.min(...boards.map((b) => b.x));
	const top = Math.min(...boards.map((b) => b.y));
	const width = Math.max(...boards.map((b) => b.x + b.width)) - left;
	const height = Math.max(...boards.map((b) => b.y + b.height)) - top;
	const padding = Math.min(48, viewport.width / 12);
	const room = { width: viewport.width - padding * 2, height: viewport.height - padding * 2 };
	const scale = clamp(Math.min(1, room.width / width, room.height / height));
	return {
		scale,
		x: (viewport.width - width * scale) / 2 - left * scale,
		y: (viewport.height - height * scale) / 2 - top * scale
	};
}

/** The scale one artboard is shown at on its own: as large as fits, up to its real size. */
export function fullScale(board: ArtboardSize, viewport: ArtboardSize): number {
	return clamp(Math.min(1, viewport.width / board.width, viewport.height / board.height));
}
