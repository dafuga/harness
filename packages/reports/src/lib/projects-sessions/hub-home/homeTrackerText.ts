// @harness-uid u_n6uc4xjkdd
import { sanitizeText } from '../project-overview/projectOverviewPrivacy';
import { trackerStructuredAsk } from '../../../../../../src/utils/projects-sessions/trackerStructuredAsk';
import type { TrackerItemRecord } from '../project-overview/projectOverviewTracker.types';

export function homeText(value: string | null | undefined, max: number) {
	if (!value) return null;
	return sanitizeText(value).slice(0, max);
}

export function openQuestion(item: TrackerItemRecord) {
	return trackerStructuredAsk(item) ? homeText(item.question, 2000) : null;
}
