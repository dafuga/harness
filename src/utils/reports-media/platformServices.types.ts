import type { ProcessProbes } from '../development-tooling/processProbes';
import type { ProcessFacts } from '../development-tooling/processProbes';

/** The developer tools in use and the services of theirs that a command may hand over. */
export interface ServiceAuthority {
	/** The developer directory, canonical. */
	root: string;
	/** The signed code that directory is part of, and what its signature must satisfy. */
	rootCode: string;
	rootRequirement: string;
	/** Each service by its exact path inside the directory, and what its running code must satisfy. */
	services: { path: string; requirement: string }[];
}

/**
 * delegated: a vetted service, vouched for, that left its command and is the system's now.
 * protected: possibly a shared service, or not to be told apart; never signalled, never passed.
 * private: the command's own. gone: no longer the process that was followed.
 */
export type Standing = 'delegated' | 'protected' | 'private' | 'gone';

export interface Verdict {
	standing: Standing;
	reason: string;
	executable: string | null;
}

export interface ServiceContext {
	authority: () => ServiceAuthority | null | Promise<ServiceAuthority | null>;
	/** The process group of the command. */
	group: number;
	/** How processes are looked at; the system's own tools unless a test stands in between. */
	probes?: ProcessProbes;
	/** Ends the looks that are under way when the work they belong to is over. */
	signal?: AbortSignal;
}

export type Facts = ProcessFacts;
