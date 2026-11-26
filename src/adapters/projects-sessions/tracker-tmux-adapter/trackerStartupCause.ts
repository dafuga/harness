// @harness-uid u_t26aucznfe
import { redactSecrets } from '../../../utils/agents-providers/redactSecrets';

/** One bounded, redacted line explaining why a launch failed. */
export function trackerStartupCause(text: string): string | undefined {
	return (
		redactSecrets(text)
			.replace(/(https?:\/\/)[^/\s@]+@/g, '$1[redacted]@')
			.replace(/\s+/g, ' ')
			.trim()
			.slice(-400) || undefined
	);
}
