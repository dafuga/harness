// @harness-uid u_qhdifpyhqs
import type { HomeAgent } from './hubHome.types';

/** The Home lists: the user-controlled agents, and the asks other projects have for Daniel. */
export interface HomeLists {
	agents: HomeAgent[];
	/** Needs-you agents that are not listed. Their question and option buttons still show. */
	asks: HomeAgent[];
}
