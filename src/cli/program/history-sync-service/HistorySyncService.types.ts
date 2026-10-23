export type RefChange = 'absent' | 'unchanged' | 'created' | 'fast-forwarded' | 'merged';

export interface Synced {
	remote: string;
	/** What happened to the evidence branch: locally on fetch and sync, remotely on push. */
	evidence: RefChange;
	notes: RefChange;
	/** True when the remote received anything. */
	pushed: boolean;
	/** Present only when something is incomplete, for example media the remote does not have. */
	problems?: string[];
}

export type Relation = 'none' | 'same' | 'ahead' | 'behind' | 'new' | 'diverged';
