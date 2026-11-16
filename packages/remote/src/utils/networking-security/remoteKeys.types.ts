// @harness-uid u_y6g47qcgym
/** A remote key that is malformed, mismatched with its stored public point, or not exportable. */
export class RemoteKeyError extends Error {
	override name = 'RemoteKeyError';
}
