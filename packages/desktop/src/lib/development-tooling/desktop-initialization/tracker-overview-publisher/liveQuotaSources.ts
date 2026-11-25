// @harness-uid u_w3n8r5ctby
import { createCodexQuotaSource, type QuotaSource } from './codexQuotaSource';

/** The subscriptions this Mac can read for itself, with no connect step. */
export function liveQuotaSources(): QuotaSource[] {
	return [createCodexQuotaSource()];
}
