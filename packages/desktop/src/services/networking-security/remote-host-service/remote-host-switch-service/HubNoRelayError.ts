// @harness-uid u_wcoqscxpf4
/** The hub's registration answer has no usable relay origin, or names a different host ID. */
export class HubNoRelayError extends Error {
	override name = 'HubNoRelayError';
}
