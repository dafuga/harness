// @harness-uid u_3kq7ov1ptb
import type { OverviewSnapshot } from '$reports/lib/projects-sessions/project-overview/projectOverview.types';

/**
 * What the owner endpoint answered. Only an owner answer carries a snapshot; a refusal or a failed
 * read carries nothing, so no earlier account's data can be shown with it.
 */
export type OverviewOutcome =
	| { kind: 'owner'; snapshot: OverviewSnapshot }
	| { kind: 'denied' }
	| { kind: 'failed' };
