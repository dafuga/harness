// @harness-uid u_w3n8r5ctby
import { createClaudeQuotaSource } from './claudeQuotaSource';
import { createCodexQuotaSource } from './codexQuotaSource';
import type { QuotaSource } from './codexQuotaSource.types';

/** The subscriptions this Mac can read for itself, with no connect step. */
export function liveQuotaSources(): QuotaSource[] {
	return [createClaudeQuotaSource(), createCodexQuotaSource()];
}
