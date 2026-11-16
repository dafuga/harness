// @harness-uid u_4rcxblyxfk
/** A picker write whose params.edits is not an array; no config request is sent. */
export class InvalidConfigurationEditsError extends Error {
	override name = 'InvalidConfigurationEditsError';
}
