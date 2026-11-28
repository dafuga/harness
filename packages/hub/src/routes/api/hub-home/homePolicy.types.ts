import type { OverviewDeps } from '../tracker-overview/trackerOverviewPolicy.types';

export interface HomeDeps extends OverviewDeps {
	db?: D1Database;
	outgoingDrafts?: boolean;
	/** The account objects that push change notices; without them apps only poll. */
	accounts?: DurableObjectNamespace | null;
}
