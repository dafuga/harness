export interface Row {
	started: string;
	executable: string;
}

export interface Settling {
	developer: string | null;
	/** When each of this build's own processes was first asked to end. */
	asked: Map<number, number>;
	/** The process group this build runs in. */
	group: number;
}

/** What is read once, before any process is started and waited for: reading it blocks. */
export type Standing = Pick<Settling, 'developer' | 'group'>;

export interface FollowedResult {
	code: number;
	output: string;
	/** Why the build could not wait for what it started, when it could not. */
	left: string | null;
}
