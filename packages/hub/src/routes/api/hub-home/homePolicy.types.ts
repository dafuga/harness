import type { OverviewDeps } from '../tracker-overview/trackerOverviewPolicy.types';

export interface HomeDeps extends OverviewDeps {
	db?: D1Database;
}
