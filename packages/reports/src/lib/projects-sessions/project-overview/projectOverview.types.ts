// @harness-uid u_2aj7ipsk7y
/** The five project states, in the order they are picked. */
export type ProjectState = 'needs-you' | 'blocked' | 'active' | 'quiet' | 'done';

/** Status of one computer as reported by the tracker's machine list. */
export type MachineStatus = 'ok' | 'busy' | 'overloaded' | 'offline';

/** One tracker item as shown on a card or in the read-only item detail. */
export type OverviewItem = {
	id: string;
	title: string;
	status: 'open' | 'in_progress' | 'blocked' | 'done';
	updatedAt: string;
	due: string | null;
	live: boolean;
	stale: boolean;
	/** Current queue or blocked state when Home has a matching Tracker schedule reading. */
	workLabel?: string;
};

/** A question or blocked reason with the item it belongs to. */
export type OverviewCallout = { item: OverviewItem; text: string };

/** One project card, one per tracker agent value. */
export type OverviewCard = {
	agent: string;
	state: ProjectState;
	liveSessions: number;
	counts: Record<OverviewItem['status'], number>;
	items: OverviewItem[];
	attention: OverviewCallout | null;
	blocked: OverviewCallout | null;
	milestone: { text: string; at: string } | null;
	updatedAt: string;
};

/** A computer chip. Older Trackers omit the remote work count. */
export type OverviewMachine = { name: string; status: MachineStatus; remoteRuns?: number };

/** Confirmed overview data, or unavailable when the local tracker cannot be read. */
export type OverviewSnapshot =
	| {
			status: 'ready';
			projects: OverviewCard[];
			machines: OverviewMachine[];
			liveSessions: number;
	  }
	| { status: 'unavailable' };
