// @harness-uid u_wp5yfuo763
/** Remote host state cannot be stored or read: OS encryption is unavailable, or the stored state is unreadable. */
export class RemoteHostStoreError extends Error {
	override name = 'RemoteHostStoreError';
}
