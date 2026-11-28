// @harness-uid u_gs5pnxnxt4
import { trackerTaskRoute } from './classifyTrackerTask';
import type { TrackerModelItem } from './classifyTrackerTask.types';
import { pickTrackerModel } from './pickTrackerModel';
import type { TrackerModelSelection, TrackerModelSelectionOptions } from './pickTrackerModel.types';
import { activePreferenceEnd } from './preferredClaudeRoute';

/**
 * The replacement for a model chosen before Daniel preferred Claude (a scheduled pick, a queued
 * retry or a watchdog handoff), or null when that model may still start.
 */
export function redirectTrackerRung(
	item: TrackerModelItem,
	{ cli, model }: { cli: string; model: string },
	options: TrackerModelSelectionOptions
): TrackerModelSelection | null {
	const until = activePreferenceEnd(options.claudePreferredUntil, options.now);
	if (!until || cli !== 'codex' || trackerTaskRoute(item) === 'computer-use') return null;
	const picked = pickTrackerModel({ ...item, model: undefined }, options);
	return { ...picked, reason: `${model} replaced; ${picked.reason}` };
}
