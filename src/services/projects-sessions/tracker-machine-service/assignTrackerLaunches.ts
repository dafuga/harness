// @harness-uid u_pv25xvpjzz
import { TrackerItemReadRepository } from '../../../repositories/projects-sessions/TrackerItemReadRepository';
import { trackerLaunchPlacement } from './trackerLaunchPlacement';
import type { TrackerFleetView, TrackerPlacementReservation } from './trackerLaunchPlacement.types';

/**
 * The hub hands each queued launch that names no computer to a peer that should run it. It
 * keeps the launch when it is the best computer itself, or when no computer is known to fit.
 */
export function assignTrackerLaunches(view: TrackerFleetView): void {
	const { store } = view.machines;
	const items = new TrackerItemReadRepository(store.database);
	const unassigned = store.database
		.prepare(
			`SELECT id FROM items i WHERE deleted = 0 AND auto IS NOT NULL
			AND coalesce(computer, 'auto') = 'auto' AND coalesce(launch_target, 'auto') = 'auto'
			AND status IN ('open','in_progress') AND coalesce(kind, 'task') = 'task'
			AND (needs_daniel = 0 OR resolved = 1)
			AND NOT EXISTS (SELECT 1 FROM runs r WHERE r.item_id = i.id AND r.auto_token = i.auto)`
		)
		.all() as { id: string }[];
	const reserved = new Map<string, TrackerPlacementReservation>();
	for (const { id } of unassigned) {
		const placed = trackerLaunchPlacement(items.getStored(id), view, reserved);
		if (!placed) continue;
		const used = reserved.get(placed.node) ?? { cores: 0, ramGB: 0, sessions: 0 };
		reserved.set(placed.node, {
			cores: used.cores + placed.demand.cores,
			ramGB: used.ramGB + placed.demand.ramGB,
			sessions: used.sessions + 1
		});
		if (placed.node === store.node) continue;
		store.appendLocal({
			itemId: id,
			fields: {
				computer: placed.node,
				launch_target: placed.node,
				'note+': `auto-launch: assigned to ${placed.node} (${placed.why})`
			}
		});
	}
}
