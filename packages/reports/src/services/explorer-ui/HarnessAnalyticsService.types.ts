// @harness-uid u_jtvwvk5o56
import type { analyticsSnapshot } from '../../../../../src/cli/program/analyticsMetrics';

export type AnalyticsSnapshot = ReturnType<typeof analyticsSnapshot>;
/** The analytics CLI query closed without code 0, including when a signal ended it. */
export class HarnessAnalyticsQueryError extends Error {
	override name = 'HarnessAnalyticsQueryError';
}
