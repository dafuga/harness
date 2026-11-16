// @harness-uid u_xy4emhngag
export class InvalidPublicationStagingDirectoryError extends Error {
	override name = 'InvalidPublicationStagingDirectoryError';
}

export class InvalidPublicationRetentionTimestampError extends Error {
	override name = 'InvalidPublicationRetentionTimestampError';
}

export class InvalidExportLockError extends Error {
	override name = 'InvalidExportLockError';
}
