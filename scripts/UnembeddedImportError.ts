// @harness-uid u_way5pzkggx
/** An engine source imports a relative .ts module that gameSourceLayout does not embed. */
export class UnembeddedImportError extends Error {
	override name = 'UnembeddedImportError';
}
