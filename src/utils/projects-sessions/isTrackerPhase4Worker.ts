// @harness-uid u_cy7pnc4x6u
const UNIT_TASK = /\(p4\.[^()\s]+\)\s*$/i;
const WORKER_OWNER = /\b(?:haiku|luna|worker)\b|^claude-p4-/i;

/** @pure True for one Phase 4 module or batch worker item, not the orchestrator or the plan. */
export function isTrackerPhase4Worker(title: string | null, owner: string | null): boolean {
	return (
		UNIT_TASK.test(title ?? '') ||
		(/^phase 4\b/i.test(title ?? '') && WORKER_OWNER.test(owner ?? ''))
	);
}
