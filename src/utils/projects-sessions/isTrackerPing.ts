// @harness-uid u_awrhk4a6e3
// @harness-uid u_ptjz1dping
const PING =
	/\b(?:watchdog|launch-without-run|launch-queue-stuck|urgent-launch-queue-stuck)\b|\bis idle again\b|Chief of Staff, please (?:inspect|resolve)/i;

/** A message that opens by naming Chief of Staff, optionally after "<computer>: ". */
const TO_CHIEF = /^\s*(?:[\w.-]+:\s+)?(?:CoS|Chief of Staff)\s*[:,]|\bFOR CoS\b/i;

/** @pure True when a message is for Chief of Staff: an automated ping, or addressed to them. */
export function isTrackerCosMessage(message: string | null | undefined): boolean {
	return isTrackerPing(message) || TO_CHIEF.test(message ?? '');
}

/** @pure True when a flag's question is an automated watchdog or idle-session ping for Chief of Staff, not a decision for Daniel. */
export function isTrackerPing(question: string | null | undefined): boolean {
	return PING.test(question ?? '');
}
