// @harness-uid u_syyrkcnw52
/** A project task whose branch or commit no longer matches the refreshed project revision. */
export class ProjectRevisionChangedError extends Error {
	override name = 'ProjectRevisionChangedError';
}
