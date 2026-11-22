// @harness-uid u_cfyfexqum2
/** A tool definition whose type is neither function nor custom, so no tool can be built from it. */
export class UnsupportedToolShapeError extends Error {
	override name = 'UnsupportedToolShapeError';
}
