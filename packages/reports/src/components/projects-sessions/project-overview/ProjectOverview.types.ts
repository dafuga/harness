// @harness-uid u_n72w2an74r
import type { OverviewSnapshot } from '../../../lib/projects-sessions/project-overview/projectOverview.types';

/** The Project Overview page; the component reads nothing itself and only shows what it is given. */
export interface ProjectOverviewProps {
	project?: string;
	/** The tracker snapshot; null means it is still loading. */
	snapshot: OverviewSnapshot | null;
	/** The Harness landing route the brand link returns to. */
	homeHref?: string;
	/**
	 * True when the page is the whole document (the native renderer), so it draws its own main and
	 * Harness link. False inside the website's explorer layout, which already provides both.
	 */
	standalone?: boolean;
}

/** A row of the read-only item detail. */
export interface ProjectOverviewDetailRow {
	term: string;
	value: string;
}
