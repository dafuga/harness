// @harness-uid u_u3mne4fgyr
import type { ProjectSummary } from 'collaboration';
import type {
	HomeAgent,
	HomeChatReceipt,
	HomeOpenAsk,
	HomePlan,
	HomeReminder,
	HomeRun,
	HomePastDue,
	HomeSubscription,
	HomeTrackerProject,
	OwnerHomeSnapshot,
	OpenHomeSection,
	SendHomeChat
} from '$reports/lib/projects-sessions/hub-home/hubHome.types';
import type { OverviewSnapshot } from '$reports/lib/projects-sessions/project-overview/projectOverview.types';
import type { ProjectSnapshot } from '../../../../../desktop/src/models/development-tooling/Desktop.types';
import type { DesktopProject } from '../../../../../desktop/src/models/projects-sessions/ProjectContext.types';
import type { soonestWork } from './hubHomePresentation';

export interface LinkedHome {
	/** Computers linked to the signed-in account, online or not. */
	linked: number;
	/** How many of them answered this read. */
	answered: number;
	snapshot: OwnerHomeSnapshot | null;
	/** The list of linked computers itself could not be read, so zero linked means unknown. */
	unlisted?: true;
}

export interface HomeView {
	overview: OverviewSnapshot | null;
	agents: HomeAgent[] | null;
	/** The open structured asks: what "needs you" counts and what the Agents card lists. */
	openAsks: HomeOpenAsk[];
	/** Personal reminders; null until a computer that lists them has answered. */
	reminders: HomeReminder[] | null;
	/** Tracker agent values Daniel added as sessions he created himself. */
	controlled: string[];
	plans: HomePlan[] | null;
	/** Future runs only. */
	schedule: HomeRun[] | null;
	/** Work whose time has passed: running, queued in launch order, or blocked. */
	pastDue: HomePastDue[];
	quota: HomeSubscription[] | null;
	projects: ProjectSummary[] | null;
	projectsFailed: boolean;
	projectDirectory?: HomeTrackerProject[];
	native?: {
		projects: DesktopProject[] | null;
		openProject: (id: string) => void;
		projectBusy: boolean;
		notices: string[];
	};
	trackerProjects: Extract<OverviewSnapshot, { status: 'ready' }> | null;
	projectSnapshots: Record<string, ProjectSnapshot>;
	work: ReturnType<typeof soonestWork>;
	owner: boolean;
	needsMac: boolean;
	/** Computers linked to this account, online or not. */
	linkedComputers: number;
	connectMacHref?: string;
	/** The last answer of the linked computers; null until the first one arrives. */
	computers: LinkedHome | null;
	trackerConnected: boolean;
	quotaConnected: boolean;
	now: number;
}

/** Adds or removes a session Daniel created himself, so it is listed under Agents. */
export type ChangeSession = (id: string, add: boolean) => Promise<void>;
export type ReadHomeProject = (projectId: string) => Promise<ProjectSnapshot>;

export interface HomeCardsProps {
	view: HomeView;
	open: OpenHomeSection;
	send: SendHomeChat;
	receipt: (id: string) => Promise<HomeChatReceipt>;
	needsOnly?: boolean;
}

export interface ReadHomeResult {
	granted: boolean;
	snapshot: OwnerHomeSnapshot | null;
	controlled?: string[];
	/** The Hub pushes change notices to this account. */
	live?: boolean;
}

export type {
	OpenHomeSection,
	SendHomeChat
} from '$reports/lib/projects-sessions/hub-home/hubHome.types';
