import type { OverviewItem } from '../../../lib/projects-sessions/project-overview/projectOverview.types';

/** One in-progress item row; choosing it opens the read-only detail. */
export interface ProjectOverviewItemProps {
	item: OverviewItem;
	/** The time in milliseconds that ETAs are judged against. */
	now: number;
	onOpen: (item: OverviewItem) => void;
	/** True for an item below the top one, which phones do not show. */
	extra?: boolean;
}
