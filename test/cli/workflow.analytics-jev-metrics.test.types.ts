import type { AnalyticsEvent } from '../../src/core/reports-media/analyticsTypes';

export type InvocationInput = {
	events: AnalyticsEvent[];
	type: string;
	author?: string;
	model?: string;
};
