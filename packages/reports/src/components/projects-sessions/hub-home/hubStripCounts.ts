// @harness-uid u_rcoti7b7ii
import type { HomeAgent, HomeOpenAsk } from '$reports/lib/projects-sessions/hub-home/hubHome.types';
import type { StripCounts } from './hubStripCounts.types';

/** @pure The Sessions running and Needs you tiles from the agents and open asks. */
export function stripCounts(
	agents: HomeAgent[],
	openAsks: HomeOpenAsk[],
	now: number
): StripCounts {
	throw new Error(`stripCounts is not built yet (${agents.length}/${openAsks.length} at ${now})`);
}
