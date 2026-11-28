// @harness-uid u_bl6xl2h4a3
import type { TrackerModelItem } from '../../../utils/agents-providers/classifyTrackerTask.types';
import { redirectTrackerRung } from '../../../utils/agents-providers/redirectTrackerRung';
import type { TrackerPersistenceService } from '../TrackerPersistenceService';
import { trackerProviderHold } from './trackerProviderHolds';
import { trackerClaudePreferredUntil } from './trackerProviderPreference';

/** A handoff waits only for a hold on the provider it will start, not the one it leaves. */
export function trackerHandoffHold(
	store: TrackerPersistenceService,
	{ item, run, now }: { item: TrackerModelItem; run: { cli: string; model: string }; now: number }
): string | null {
	const claudePreferredUntil = trackerClaudePreferredUntil(store, now);
	const next = redirectTrackerRung(item, run, { now, claudePreferredUntil })?.rung.cli;
	return trackerProviderHold(store, next ?? run.cli, now);
}
