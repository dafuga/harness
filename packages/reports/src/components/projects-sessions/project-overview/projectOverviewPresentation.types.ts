// @harness-uid u_heb2rvinqp
import type {
	OverviewCard,
	ProjectState
} from '../../../lib/projects-sessions/project-overview/projectOverview.types';

/** A state filter; all selects every project. */
export type OverviewFilter = 'all' | ProjectState;

/** One filter chip with the number of projects it selects. */
export interface OverviewChip {
	value: OverviewFilter;
	label: string;
	count: number;
}

/** The page bands, in the order they are shown. */
export type OverviewBandId = 'attention' | 'active' | 'quiet' | 'done';

/** A band of projects under its heading. */
export interface OverviewBand {
	id: OverviewBandId;
	label: string;
	cards: OverviewCard[];
}

/** An item's ETA: current state, not set, or the day it is due. */
export interface OverviewEta {
	text: string;
	tone: 'current' | 'none' | 'scheduled';
}
