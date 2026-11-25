// @harness-uid u_kda7xezayo
import type { OverviewSnapshot } from '../project-overview/projectOverview.types';

export type HomeAgentState = 'needs-you' | 'working' | 'idle' | 'offline';
export type HomePlanState = 'draft' | 'in-review' | 'approved' | 'in-progress' | 'done';
export type HomeSection = 'agents' | 'quota' | 'plans' | 'scheduled' | 'projects' | 'wip';

export interface HomeMessage {
	id: string;
	text: string;
	at: string;
	from: 'agent' | 'you';
}

/** One task an agent has a live run on right now. */
export interface HomeAgentTask {
	itemId: string;
	title: string;
	machine: string | null;
}

/** A raw JSON value as the Tracker sends it, before it is checked. */
export type HomeAskInput = object | string | number | boolean | null | undefined;

/** One tappable answer to an open ask; recommended is true on at most one. */
export interface HomeAskOption {
	label: string;
	effect: string;
	recommended?: true;
}

/** Asks that change something hard to undo need a confirm step before a tap sends. */
export type HomeAskConfirm = 'deploy' | 'money' | 'secret';

export interface HomeAgent {
	id: string;
	name: string;
	state: HomeAgentState;
	/** Live Tracker runs on computers that are not offline. An agent is working when this is above zero. */
	sessions: number;
	/** The tasks with a live run, newest first, at most five. */
	tasks: HomeAgentTask[];
	/** Live sessions and tasks of the sub-agents working under this agent, never listed as agents themselves. */
	subAgents: { sessions: number; tasks: HomeAgentTask[] };
	itemId: string | null;
	task: string;
	machine: string | null;
	model: string | null;
	since: string;
	question: string | null;
	/** Two to four choices for the open question; empty when the ask has none. */
	options?: HomeAskOption[];
	confirm?: HomeAskConfirm;
	messages: HomeMessage[];
}

export interface HomePlan {
	id: string;
	title: string;
	project: string | null;
	state: HomePlanState;
	updatedAt: string;
	total: number;
	done: number;
	steps: { id: string; title: string; done: boolean }[];
}

export interface HomeRun {
	id: string;
	title: string;
	at: string;
	agent: string | null;
	machine: string | null;
	source: 'tracker' | 'claude';
	recurring: boolean;
	paused: boolean;
}

export interface HomeLimit {
	id: string;
	label: string;
	left: number;
	resetsAt: string | null;
}

export interface HomeSubscription {
	id: string;
	provider: 'claude' | 'codex';
	plan: string | null;
	account: string | null;
	readAt: string;
	limits: HomeLimit[];
	credits: string | null;
	history: { day: string; used: number }[];
	agents: { name: string; description: string }[];
}

export interface HomeProviderReadings {
	/** Null means a source has not been connected or its read failed. */
	routines: HomeRun[] | null;
	/** Last observation of the routine list. Missing timestamps are treated as unknown. */
	routinesReadAt?: string | null;
	quota: HomeSubscription[] | null;
}

export interface OwnerHomeSnapshot {
	overview: OverviewSnapshot;
	agents: HomeAgent[];
	plans: HomePlan[];
	scheduled: HomeRun[];
	providers: HomeProviderReadings;
}

export interface HomeChatInput {
	id: string;
	agentId: string;
	itemId: string;
	kind: 'note' | 'answer';
	question: string | null;
	text: string;
	/** A tapped option's 1-based number. The text then carries that option's label. */
	option?: number;
	confirmed?: boolean;
}

export type HomeChatStatus = 'queued' | 'sent' | 'refused' | 'unconfirmed';

export interface HomeChatReceipt {
	id: string;
	status: HomeChatStatus;
}
