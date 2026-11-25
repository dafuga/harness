// @harness-uid u_awrhk4a6e3
// @harness-uid u_ptjz1dping
const PING =
	/\b(?:watchdog|launch-without-run|launch-queue-stuck|urgent-launch-queue-stuck)\b|\bis idle again\b|Chief of Staff, please (?:inspect|resolve)/i;

/** @pure True when a flag's question is an automated watchdog or idle-session ping for Chief of Staff, not a decision for Daniel. */
export function isTrackerPing(question: string | null | undefined): boolean {
	return PING.test(question ?? '');
}
