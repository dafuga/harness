// @harness-uid u_fcsung7usu
/** A replay store or restore rejects as invalid, expired, or differing from its receipt. */
export class ReplayStorageError extends Error {
	override name = 'ReplayStorageError';
}
