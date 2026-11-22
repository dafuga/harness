/** The canvas gave no 2D rendering context, so no software renderer can be created. */
export class Canvas2dContextUnavailableError extends Error {
	override name = 'Canvas2dContextUnavailableError';
}
