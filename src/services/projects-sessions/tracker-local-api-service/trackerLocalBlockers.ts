// @harness-uid u_g7kdpz7bel
import type { TrackerItemReadRepository } from '../../../repositories/projects-sessions/TrackerItemReadRepository';
import type { TrackerBlocker } from '../../../repositories/projects-sessions/TrackerItemReadRepository.types';
import { planTrackerItemMutation } from '../../../utils/projects-sessions/planTrackerItemMutation';
import type { TrackerLocalApiOptions } from '../TrackerLocalApiService.types';
import type { TrackerPersistenceService } from '../TrackerPersistenceService';
import type { TrackerBlockerSyncResult } from './trackerLocalBlockers.types';
import { itemMutationContext } from './trackerLocalItemMutation';

const recheckSpacingMs = 24 * 60 * 60_000;

/**
 * Apply the inbox rules: put Daniel-typed blocks on Needs Daniel, and chase the owner of a stale
 * blocker or one whose dependency is done, at most once a day.
 */
export function syncTrackerBlockers(
	ports: {
		store: TrackerPersistenceService;
		items: TrackerItemReadRepository;
		options: TrackerLocalApiOptions;
	},
	actor: string | null
): TrackerBlockerSyncResult {
	const { store, items, options } = ports;
	const now = options.now?.() ?? Date.now();
	const escalated: string[] = [];
	const rechecked: string[] = [];
	for (const entry of items.blockerEntries(now)) {
		if (entry.kind === 'note') continue;
		const context = itemMutationContext(store, items, options);
		const item = items.resolve(entry.id);
		if (entry.needs_escalation) {
			write(
				store,
				actor,
				planTrackerItemMutation({ action: 'flag', item, body: escalation(entry) }, context)
			);
			escalated.push(entry.id);
		} else if (
			entry.recheck &&
			now - (Date.parse(entry.chased_at ?? '') || 0) >= recheckSpacingMs
		) {
			const body = { note: `blocker recheck: ${entry.recheck}` };
			write(store, actor, planTrackerItemMutation({ action: 'chase', item, body }, context));
			rechecked.push(entry.id);
		}
	}
	return { escalated, rechecked, blockers: items.blockers(now) };
}

function escalation(entry: TrackerBlocker) {
	return {
		question: `Blocked (${entry.label}): ${entry.action}`,
		force: true
	};
}

function write(
	store: TrackerPersistenceService,
	actor: string | null,
	plan: ReturnType<typeof planTrackerItemMutation>
) {
	store.appendLocal({ itemId: plan.itemId, fields: plan.fields, actor });
}

/** Serve GET /blockers and POST /blockers/sync; any other request is not a blockers route. */
export function trackerBlockersRoute(
	request: Request,
	parts: string[],
	ports: {
		store: TrackerPersistenceService;
		items: TrackerItemReadRepository;
		options: TrackerLocalApiOptions;
	},
	actor: string | null
): object | undefined {
	const route = `${request.method} ${parts.join('/')}`;
	if (route === 'GET blockers') return ports.items.blockers(ports.options.now?.() ?? Date.now());
	return route === 'POST blockers/sync' ? syncTrackerBlockers(ports, actor) : undefined;
}
