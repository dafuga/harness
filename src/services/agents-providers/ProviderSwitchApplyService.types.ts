// @harness-uid u_lu75xupxt4
/** A switch whose settings could not be verified after resume, or whose request changed owner. */
export class SwitchVerificationError extends Error {
	override name = 'SwitchVerificationError';
}
