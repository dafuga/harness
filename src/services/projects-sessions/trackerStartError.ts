import { redactSecrets } from '../../utils/agents-providers/redactSecrets';

/** A bounded, redacted cause for a start call that threw. */
export function trackerStartError(error: unknown) {
	const message = error instanceof Error ? error.message : String(error);
	return { type: 'start-error', reason: redactSecrets(message).slice(0, 500) } as const;
}
