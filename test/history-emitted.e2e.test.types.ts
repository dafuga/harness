/**
 * What the portable history holds about the size of what a unit emits: one number for each
 * execution target at every measured commit, the limits the ledger of a revision freezes, and
 * every review that set or changed them. A viewer reads all of it from the index alone.
 */
export interface Point {
	commit: string;
	emitted?: Record<string, number>;
	notes?: Record<string, string>;
}

export interface Review {
	type: string;
	commit: string;
	reviewer: string;
	reason: string;
	before?: Record<string, number>;
	after: Record<string, number>;
	unmeasured?: Record<string, string>;
}

export interface Unit {
	id: string;
	growth: Point[];
	reviews?: Review[];
}

export interface View {
	id: string;
	emitted?: { limits: Record<string, number>; unmeasured?: Record<string, string> };
	limits?: { metrics: Record<string, number>; unmeasured?: Record<string, string> };
}
