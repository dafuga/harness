// @harness-uid u_e6ppqxpxuf
/** A workspace address that cannot be read: not a workspace address, a bad commit or category. */
export class WorkspaceAddressError extends Error {
	override name = 'WorkspaceAddressError';
}
