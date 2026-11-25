// @harness-uid u_nsxu3st5to
/** Thrown when this process belongs to no browser run: HARNESS_E2E_ROOT is unset or empty. */
export class E2eRootNotSetError extends Error {
	override name = 'E2eRootNotSetError';
}
