// @harness-uid u_k4rxbz6pq3
import type { OverviewSnapshot } from '$reports/lib/projects-sessions/project-overview/projectOverview.types';

/** The display snapshot a native publisher sends, or the unavailable answer it may send instead. */
export type OverviewPayload = OverviewSnapshot;

/** A `ready` snapshot after the strict shape check. */
export type ReadyOverviewPayload = Extract<OverviewSnapshot, { status: 'ready' }>;

/** A parsed JSON object before its keys are checked. */
export type OverviewRecord = Record<string, unknown>;
