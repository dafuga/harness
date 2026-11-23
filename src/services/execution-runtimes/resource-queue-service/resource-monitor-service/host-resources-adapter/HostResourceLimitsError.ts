// @harness-uid u_lf5pz3ccb3
/** Cgroup-v2 host limits could not be established, or held an invalid membership path or quota. */
export class HostResourceLimitsError extends Error {
	override name = 'HostResourceLimitsError';
}
