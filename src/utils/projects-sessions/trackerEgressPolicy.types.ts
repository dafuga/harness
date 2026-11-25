// @harness-uid u_xvchqaifoy
// @harness-uid u_egrpol0001

/** Exact hostnames the opt-in pilot may reach, grouped so the inventory stays reviewable. */
export interface TrackerEgressPolicyInput {
	/** Tracker hub callback hosts, from the launching node's own configuration. */
	trackerHosts: readonly string[];
	/** Project-scoped staging and preprod hosts, from the item's project configuration. */
	projectHosts?: readonly string[];
}

export interface TrackerEgressPolicy {
	hosts: readonly string[];
}

export type TrackerEgressProvider = 'codex' | 'claude';
