// @harness-uid u_dup47o3woo
import type { HomeAgent, HomeOpenAsk } from '$reports/lib/projects-sessions/hub-home/hubHome.types';

/** The listed Home snapshot the dock reads: user-controlled agents, other askers and open asks. */
export interface HubDockSource {
	agents: HomeAgent[];
	/** Projects outside the list that need Daniel. */
	asks: HomeAgent[];
	openAsks: HomeOpenAsk[];
}

export interface HubDockRow {
	agent: HomeAgent;
	/** One line under the name: the oldest question, or what the agent is doing. */
	line: string;
}

export interface HubDockAsker extends HubDockRow {
	/** When the oldest open question was asked. */
	since: string;
}

export interface HubDockModel {
	/** Agents with an open question, the longest wait first. */
	asking: HubDockAsker[];
	working: HubDockRow[];
	/** Everyone a message can reach, Chief of Staff first. */
	reachable: HomeAgent[];
}
