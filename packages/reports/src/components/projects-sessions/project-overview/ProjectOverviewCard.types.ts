// @harness-uid u_5zc2xsq34f
import type {
	OverviewCard,
	OverviewItem
} from '../../../lib/projects-sessions/project-overview/projectOverview.types';

/** One project card; the card only displays what it is given and asks for an item to open. */
export interface ProjectOverviewCardProps {
	card: OverviewCard;
	/** The time in milliseconds that ETAs are judged against. */
	now: number;
	onOpen: (item: OverviewItem) => void;
	onDecision?: (item: OverviewItem) => void;
}
