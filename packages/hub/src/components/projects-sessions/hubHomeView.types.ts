// @harness-uid u_u3mne4fgyr
import type { ProjectSummary } from 'collaboration';
import type {
	HomeAgent,
	HomeChatInput,
	HomeChatReceipt,
	HomePlan,
	HomeRun,
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
	plans: HomePlan[] | null;
	schedule: HomeRun[] | null;
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
	routinesConnected: boolean;
	quotaConnected: boolean;
	now: number;
}

export type OpenHomeSection = (section: HomeSection, agentId?: string) => void;
export type SendHomeChat = (message: HomeChatInput) => Promise<HomeChatReceipt>;
export type ReadHomeProject = (projectId: string) => Promise<ProjectSnapshot>;

export interface HomeAgentsProps {
	agents: HomeAgent[] | null;
	agentId?: string;
	send: SendHomeChat;
	receipt: (id: string) => Promise<HomeChatReceipt>;
	chatOpen?: boolean;
	chatName?: string;
}

export interface ReadHomeResult {
	granted: boolean;
	snapshot: OwnerHomeSnapshot | null;
}
