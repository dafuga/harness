// @harness-uid u_jpdkjh3qxl
/** A permission profile whose id differs from its source filename or repeats another profile's id. */
export class ProfileIdentityError extends Error {
	override name = 'ProfileIdentityError';
}
