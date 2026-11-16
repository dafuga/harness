// @harness-uid u_oh7ut73h75
/** A spawned command, such as the pinned cargo or rustc, that did not exit with code 0. */
export class CommandFailedError extends Error {
	override name = 'CommandFailedError';
}
