// @harness-uid u_u3mne4fgyr
import type { ProjectSummary } from 'collaboration';
import type {
	HomeAgent,
	HomeChatInput,
	HomeChatReceipt,
	HomeOpenAsk,
	HomePlan,
	HomeRun,
	HomePastDue,
	HomeSection,
	HomeSubscription,
	OwnerHomeSnapshot
} from '$reports/lib/projects-sessions/hub-home/hubHome.types';
import type { OverviewSnapshot } from '$reports/lib/projects-sessions/project-overview/projectOverview.types';
import type { ProjectSnapshot } from '../../../../desktop/src/models/development-tooling/Desktop.types';
import type { soonestWork } from './hubHomePresentation';

export interface HomeView {
	overview: OverviewSnapshot | null;
	agents: HomeAgent[] | null;
	/** Other projects' agents that need you now; they are not listed under Agents but their asks show. */
	asks: HomeAgent[];
	/** The open structured asks: what "needs you" counts and what the Agents card lists. */
	openAsks: HomeOpenAsk[];
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
	trackerProjects: Extract<OverviewSnapshot, { status: 'ready' }> | null;
	projectSnapshots: Record<string, ProjectSnapshot>;
	work: ReturnType<typeof soonestWork>;
	owner: boolean;
	needsMac: boolean;
	/** Computers linked to this account, online or not. */
	linkedComputers: number;
	trackerConnected: boolean;
	quotaConnected: boolean;
	now: number;
}

export type OpenHomeSection = (section: HomeSection, agentId?: string) => void;
/** Adds or removes a session Daniel created himself, so it is listed under Agents. */
export type ChangeSession = (id: string, add: boolean) => Promise<void>;
export type SendHomeChat = (message: HomeChatInput) => Promise<HomeChatReceipt>;
export type ReadHomeProject = (projectId: string) => Promise<ProjectSnapshot>;

export interface ReadHomeResult {
	granted: boolean;
	snapshot: OwnerHomeSnapshot | null;
	controlled?: string[];
	/** The Hub pushes change notices to this account. */
	live?: boolean;
}
