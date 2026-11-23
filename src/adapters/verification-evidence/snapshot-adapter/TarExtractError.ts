// @harness-uid u_l3f5bpp55y
/** Tar exited nonzero while extracting a commit export; the message carries its stderr. */
export class TarExtractError extends Error {
	override name = 'TarExtractError';
}
