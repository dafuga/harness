import type { ProjectActivity } from '../core/activityTypes';
import type { LoopState } from '../workflows/loop-state/loopState';

export interface ActivityRevision {
	commit: string;
	subject: string;
	author: string;
	committedAt: string;
	branches: string[];
}

/** Everything an activity is assembled from; each part is read by the caller, none here. */
export interface ActivitySource {
	kind: ProjectActivity['kind'];
	repository: ProjectActivity['repository'];
	/** Commits, newest first. */
	revisions: ActivityRevision[];
	reasons: (commit: string) => Array<{ unit: string; behavior: string }>;
	changes: (commit: string) => Array<{ path: string; status: string }>;
	owners: (path: string) => string[];
	loops: LoopState[];
	limit: { work: number; files: number; reasons: number; units: number };
}

export { projectActivity } from '../services/project-activity-service/projectActivity';
