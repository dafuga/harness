// @harness-uid u_gs5pnxnxt4
import type { TrackerModelItem } from './classifyTrackerTask.types';
import { pickTrackerModel } from './pickTrackerModel';
import type { TrackerModelSelection, TrackerModelSelectionOptions } from './pickTrackerModel.types';
import { activePreferenceEnd } from './preferredClaudeRoute';
import { hasExplicitModel } from './trackerExplicitModel';
import { trackerTaskType } from './trackerTaskType';

interface EarlierChoice {
	cli: string;
	model: string;
	effort?: string | null;
}

/**
 * The replacement for a model chosen earlier (a scheduled pick, a queued retry or a watchdog
 * handoff), or null when that model may still start. An explicit --model replaces any other
 * choice; otherwise only the Claude preference replaces an earlier Codex one.
 */
export function redirectTrackerRung(
	item: TrackerModelItem,
	choice: EarlierChoice,
	options: TrackerModelSelectionOptions
): TrackerModelSelection | null {
	if (hasExplicitModel(item)) return explicitRedirect(item, choice, options);
	const until = activePreferenceEnd(options.claudePreferredUntil, options.now);
	if (!until || choice.cli !== 'codex' || trackerTaskType(item) === 'computer-use') return null;
	return replaced(choice, pickTrackerModel({ ...item, model: undefined }, options));
}

function explicitRedirect(
	item: TrackerModelItem,
	choice: EarlierChoice,
	options: TrackerModelSelectionOptions
) {
	const picked = pickTrackerModel(item, options);
	const { model, effort } = picked.rung;
	const same = model === choice.model && (!choice.effort || choice.effort === effort);
	return same ? null : replaced(choice, picked);
}

function replaced({ model }: EarlierChoice, picked: TrackerModelSelection) {
	return { ...picked, reason: `${model} replaced; ${picked.reason}` };
}
