// @harness-uid u_kda7xezayo
import type { OverviewSnapshot } from '../project-overview/projectOverview.types';

export type HomeAgentState = 'needs-you' | 'working' | 'idle' | 'offline';
export type HomePlanState = 'draft' | 'in-review' | 'approved' | 'in-progress' | 'done';
export type HomeSection = 'agents' | 'quota' | 'plans' | 'scheduled' | 'projects' | 'wip';

export interface HomeMessage {
	id: string;
	text: string;
	at: string;
	/** 'tracker': a note posted to the Tracker item, not a reply from the agent. */
	from: 'agent' | 'you' | 'tracker';
}

export interface HomeAgent {
	id: string;
	name: string;
	state: HomeAgentState;
	itemId: string | null;
	task: string;
	machine: string | null;
	model: string | null;
	since: string;
	question: string | null;
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
}

export type HomeChatStatus = 'queued' | 'sent' | 'refused' | 'unconfirmed';

export interface HomeChatReceipt {
	id: string;
	status: HomeChatStatus;
}
