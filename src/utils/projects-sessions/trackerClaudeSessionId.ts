// @harness-uid u_ji63fsuyd2
const attemptToken = /^[a-f0-9]{64}$/;

/**
 * The Claude session id of a managed attempt, derived from its attempt token. The run's
 * `session_id` keeps the token, so the transcript is found without storing a second id.
 */
export function trackerClaudeSessionId(token: string): string | undefined {
	if (!attemptToken.test(token)) return undefined;
	return [
		token.slice(0, 8),
		token.slice(8, 12),
		`4${token.slice(13, 16)}`,
		`8${token.slice(17, 20)}`,
		token.slice(20, 32)
	].join('-');
}
