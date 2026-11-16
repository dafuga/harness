// @harness-uid u_mzxzutsjlc
export class ProjectNotSelectedError extends Error {
	override name = 'ProjectNotSelectedError';
}

export class ProjectSwitchBlockedError extends Error {
	override name = 'ProjectSwitchBlockedError';
}

export class ProjectNotOpenError extends Error {
	override name = 'ProjectNotOpenError';
}

export class ProjectRevisionReadOnlyError extends Error {
	override name = 'ProjectRevisionReadOnlyError';
}

export class CheckedOutBranchChangedError extends Error {
	override name = 'CheckedOutBranchChangedError';
}
