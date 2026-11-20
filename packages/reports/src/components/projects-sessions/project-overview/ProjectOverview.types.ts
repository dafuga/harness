import type { OverviewSnapshot } from '../../../lib/projects-sessions/project-overview/projectOverview.types';

/** The Project Overview page; the component reads nothing itself and only shows what it is given. */
export interface ProjectOverviewProps {
	/** The tracker snapshot; null means it is still loading. */
	snapshot: OverviewSnapshot | null;
	/** The Harness landing route the brand link returns to. */
	homeHref?: string;
}

/** A row of the read-only item detail. */
export interface ProjectOverviewDetailRow {
	term: string;
	value: string;
}
