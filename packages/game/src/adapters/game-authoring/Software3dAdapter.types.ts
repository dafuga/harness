export type Point = [number, number, number];

export type Box = { id: string; at: Point; size: Point; color: string };

/** The canvas gave no 2D rendering context, so no software renderer can be created. */
export class Canvas2dContextUnavailableError extends Error {
	override name = 'Canvas2dContextUnavailableError';
}
