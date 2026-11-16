// @harness-uid u_hia5m25mf6
export class InvalidReplayDirectoryError extends Error {
	override name = 'InvalidReplayDirectoryError';
}

export interface StorageSyncOptions {
	run?: string;
	dryRun?: boolean;
}
