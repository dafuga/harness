import type { AnalyticsEvent } from '../../core/analyticsTypes';
export interface AnalyticsEventAttributes {
	id: string;
	timestamp: string;
	data: AnalyticsEvent;
}
export type AnalyticsEventCreateInput = AnalyticsEventAttributes;
export type AnalyticsEventUpdateInput = Partial<Omit<AnalyticsEventAttributes, 'id'>>;
