// @harness-uid u_l2kesnyfm7
export class InvalidHostedProjectIdError extends Error {
	override name = 'InvalidHostedProjectIdError';
}

export class HostedCacheCommitMismatchError extends Error {
	override name = 'HostedCacheCommitMismatchError';
}

export class HostedCommitMismatchError extends Error {
	override name = 'HostedCommitMismatchError';
}
