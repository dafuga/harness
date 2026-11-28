// @harness-uid u_bl6xl2h4a3
/** What a script or session sent to Chief of Staff itself, as opposed to a session-health check. */
export const trackerCosInboxKinds: ReadonlySet<string> = new Set([
	'alert',
	'flag-refused',
	'cos-message',
	'launch-startup-failed'
]);

/** How long a message stays in the inbox when its item is finished or unknown. */
export const trackerCosInboxRetention = 7 * 24 * 60 * 60_000;
