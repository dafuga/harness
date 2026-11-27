// @harness-uid u_piy2pdpljn
import { pickTrackerModel } from '../../../utils/agents-providers/pickTrackerModel';
import type { TrackerLadderConfig } from '../../../utils/agents-providers/parseTrackerModelSpec.types';
import { trackerItemError } from '../../../utils/projects-sessions/trackerItemError';
import type { TrackerPersistenceService } from '../TrackerPersistenceService';
import { trackerPreferredProviderSchema } from '../tracker-node-service/trackerRoutingSchema';

const key = 'autolaunch_preferred_provider';

/** Read the host's live override, with the Tracker node configuration as its default. */
export function trackerRoutingWithPreference(
	store: TrackerPersistenceService,
	config?: TrackerLadderConfig
): TrackerLadderConfig {
	return {
		autolaunch: {
			...config?.autolaunch,
			get preferredProvider() {
				const stored = store.getMeta(key);
				const configured = config?.autolaunch?.preferredProvider;
				if (!stored) return configured;
				try {
					return trackerPreferredProviderSchema.parse(JSON.parse(stored));
				} catch {
					return configured;
				}
			}
		}
	};
}

export function trackerPreferredProviderAdmin(
	store: TrackerPersistenceService,
	{ ladderConfig, now }: { ladderConfig?: TrackerLadderConfig; now: () => number }
) {
	function read() {
		const { rung, reason } = pickTrackerModel({}, { cfg: ladderConfig, now: now() });
		return {
			setting: ladderConfig?.autolaunch?.preferredProvider ?? null,
			effective: rung.cli,
			reason
		};
	}
	return {
		read,
		update(value: unknown) {
			const parsed = trackerPreferredProviderSchema.nullable().safeParse(value);
			if (!parsed.success) throw trackerItemError('Invalid Tracker provider or switch time', 400);
			store.writeMeta({ [key]: parsed.data ? JSON.stringify(parsed.data) : '' });
			return read();
		}
	};
}
