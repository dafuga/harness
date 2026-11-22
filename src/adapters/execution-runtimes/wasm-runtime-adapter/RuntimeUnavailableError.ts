// @harness-uid u_hqa74vec52
/** The unit could not be loaded at all: its module lacks the Harness JSON ABI or cannot be read. */
export class RuntimeUnavailableError extends Error {
	override name = 'RuntimeUnavailable';
}
