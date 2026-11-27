// @harness-uid u_mzhcxeicv4
/** A level generation that was refused or failed; its fixed message names the failed check. */
export class LevelGenerationError extends Error {
	override name = 'LevelGenerationError';
}
