// @harness-uid u_mdrydzunlb
import { isTrackerCosMessage } from './isTrackerPing';
import type { TrackerAskState } from './trackerStructuredAsk.types';

export const trackerCosDeliveryAskTitle = 'Tracker alerts are not reaching Chief of Staff';

/** @pure A recovered delivery alarm must disappear even if its old flag is still present. */
export function isClosedTrackerCosDeliveryAsk(item: TrackerAskState): boolean {
	return (
		item.title === trackerCosDeliveryAskTitle && (item.status === 'done' || Boolean(item.resolved))
	);
}

/**
 * @pure What an item's open flag is. An "ask" is a real Daniel decision: a question with 2 to 4
 * choices, exactly one recommended. A "ping" is an automated session alert and "needs-options" is
 * any other flag, such as a dependency block; both are for Chief of Staff. No open flag is null.
 */
export function trackerFlagKind(item: TrackerAskState): 'ask' | 'ping' | 'needs-options' | null {
	if (
		!item.needs_daniel ||
		item.resolved ||
		item.status === 'ignored' ||
		isClosedTrackerCosDeliveryAsk(item)
	)
		return null;
	if (isTrackerCosMessage(item.question)) return 'ping';
	return item.question?.trim() && answerableChoices(item.options) ? 'ask' : 'needs-options';
}

/** @pure True only for an open structured ask: the one thing "needs you" counts and lists. */
export function trackerStructuredAsk(item: TrackerAskState): boolean {
	return trackerFlagKind(item) === 'ask';
}

/** @pure Options arrive as a list, or as the stored JSON text. Anything unreadable is none. */
function answerableChoices(value: TrackerAskState['options']): boolean {
	const list = typeof value === 'string' ? readList(value) : value;
	if (!Array.isArray(list) || list.length < 2 || list.length > 4) return false;
	const labelled = list.every((option) => Boolean(option?.label?.trim()));
	return labelled && list.filter((option) => option.recommended === true).length === 1;
}

function readList(stored: string): unknown {
	try {
		return JSON.parse(stored);
	} catch {
		return null;
	}
}
