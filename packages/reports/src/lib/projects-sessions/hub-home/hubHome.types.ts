// @harness-uid u_kda7xezayo
import type { HomeOutgoingSource } from '$reports/components/projects-sessions/hub-home/hubHomeOutgoingDraft.types';
import type { OverviewSnapshot, ProjectState } from '../project-overview/projectOverview.types';
import type * as Planning from '../../../../../../src/utils/projects-sessions/trackerPlanning.types';
import type { HomeLiveOverview } from './homeLive.types';

import type { TrackerAttachment } from '../../../../../../src/utils/projects-sessions/trackerAttachment.types';
import type { HubMessageStatus } from '../../../../../../src/utils/projects-sessions/hubSessionMessages.types';
import type { HomeChatInput, HomeChatReceipt } from './homeChat.types';

export type * from './homeChat.types';

export type HomeAgentState = 'needs-you' | 'working' | 'idle' | 'offline';
export type HomePlanState = 'draft' | 'in-review' | 'approved' | 'in-progress' | 'done';
export type HomeSection = 'agents' | 'quota' | 'plans' | 'scheduled' | 'projects' | 'wip';

export interface HomeMessage {
	id: string;
	text: string;
	at: string;
	from: 'agent' | 'you';
	/** A Hub message's Tracker id; its receipt and replies are keyed to it. */
	messageId?: string;
	/** Where a Hub message got to: stored, typed into the session, answered, or refused. */
	status?: HubMessageStatus;
	/** Why a refused message was not delivered. */
	reason?: string;
	/** The Hub message a session's reply answers. */
	replyTo?: string;
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
	/** The live run Hub messages go to, as `<computer>#<run>`; none without a live session. */
	runId?: string | null;
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

/** One open structured ask: a question Daniel answers by tapping a choice, or by writing another. */
export interface HomeOpenAsk {
	itemId: string;
	/** The Tracker project that asked; the same value as that agent's id. */
	agentId: string;
	agentName: string;
	title: string;
	question: string;
	options: HomeAskOption[];
	confirm?: HomeAskConfirm;
	/** Specs and documents behind "View spec". */
	attachments?: TrackerAttachment[];
	since: string;
}

/** One personal reminder: a Tracker item that reminds Daniel, listed only under Reminders. */
export interface HomeReminder {
	itemId: string;
	title: string;
	/** The armed time. Done and snooze name it, so a stale tap changes nothing. */
	at: string;
	/** "Daily", "Weekly" and so on; null for a reminder that happens once. */
	repeats: string | null;
	updatedAt: string;
}

export interface HomePlan {
	id: string;
	title: string;
	project: string | null;
	state: HomePlanState;
	/** Older Home publishers omit stage and artifacts. */
	stage?: Planning.TrackerStage;
	planning?: Planning.TrackerPlanning;
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
	/** What this Tracker run is once its time passes. Older computers do not report it. */
	whenDue?: HomeWhenDue;
}

export interface HomeWhenDue {
	state: 'running' | 'queued' | 'blocked' | 'due';
	reason: string | null;
	/** Launch order class: 0 urgent, 1 normal, 2 low. */
	urgency: number;
}

/** A run whose time has passed. Queued runs carry their launch position. */
export type HomePastDue = HomeRun & {
	state: HomeWhenDue['state'];
	reason: string | null;
	position?: number;
};

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

/** A visible Tracker project, including projects whose last task finished long ago. */
export interface HomeTrackerProject {
	name: string;
	state: ProjectState;
	needsYou: number;
}

export interface OwnerHomeSnapshot {
	overview: OverviewSnapshot;
	projectDirectory?: HomeTrackerProject[];
	agents: HomeAgent[];
	/** Every open structured ask, oldest first. Older Mac apps omit it. */
	openAsks?: HomeOpenAsk[];
	/** Personal reminders, soonest first. Older Mac apps omit them. */
	reminders?: HomeReminder[];
	plans: HomePlan[];
	scheduled: HomeRun[];
	overdue?: HomeRun[];
	providers: HomeProviderReadings;
	/**
	 * Every project, session and run. Only a linked computer's answer over the encrypted
	 * connection carries it: it is never uploaded or stored. Older Mac apps omit it.
	 */
	liveOverview?: HomeLiveOverview;
}

/** The active local Mac or approved connection used by the installed apps. */
export interface TrackerHomeSource {
	outgoing?: HomeOutgoingSource;
	read(): Promise<OwnerHomeSnapshot>;
	send(message: HomeChatInput): Promise<HomeChatReceipt>;
}

export type OpenHomeSection = (section: HomeSection, itemId?: string) => void;
export type SendHomeChat = TrackerHomeSource['send'];

export interface HomePlannableView {
	plans: HomePlan[] | null;
	schedule: HomeRun[] | null;
	agents: HomeAgent[] | null;
	needsMac: boolean;
	now: number;
}
