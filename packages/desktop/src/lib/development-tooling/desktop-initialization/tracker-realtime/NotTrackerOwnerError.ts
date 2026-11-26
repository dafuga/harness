// @harness-uid u_lbn5y6x4bk
/** The signed-in account is not the tracker's owner, so this Mac does not listen for it. */
export class NotTrackerOwnerError extends Error {
	override name = 'NotTrackerOwnerError';
}
