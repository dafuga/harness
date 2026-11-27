// @harness-uid u_u3mne4fgyr
import type { ProjectSummary } from 'collaboration';
import type {
	HomeOpenAsk,
	HomePlan,
	HomeRun,
	HomeSubscription,
	OwnerHomeSnapshot
} from '$reports/lib/projects-sessions/hub-home/hubHome.types';
import type { LinkedHome } from '../../services/networking-security/LinkedHomeService';
import type { OverviewSnapshot } from '$reports/lib/projects-sessions/project-overview/projectOverview.types';
import type { ProjectSnapshot } from '../../../../desktop/src/models/development-tooling/Desktop.types';
import type { HomeWorkView } from '$reports/lib/projects-sessions/hub-home/homeLive.types';

export interface HomeView extends HomeWorkView {
	/** The open structured asks: what "needs you" counts and what the Agents card lists. */
	openAsks: HomeOpenAsk[];
	/** Tracker agent values Daniel added as sessions he created himself. */
	controlled: string[];
	plans: HomePlan[] | null;
	/** Future runs only. */
	schedule: HomeRun[] | null;
	quota: HomeSubscription[] | null;
	projects: ProjectSummary[] | null;
	projectsFailed: boolean;
	trackerProjects: Extract<OverviewSnapshot, { status: 'ready' }> | null;
	projectSnapshots: Record<string, ProjectSnapshot>;
	owner: boolean;
	needsMac: boolean;
	/** Computers linked to this account, online or not. */
	linkedComputers: number;
	/** The last answer of the linked computers; null until the first one arrives. */
	computers: LinkedHome | null;
	quotaConnected: boolean;
}

/** Adds or removes a session Daniel created himself, so it is listed under Agents. */
export type ChangeSession = (id: string, add: boolean) => Promise<void>;
export type ReadHomeProject = (projectId: string) => Promise<ProjectSnapshot>;

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
