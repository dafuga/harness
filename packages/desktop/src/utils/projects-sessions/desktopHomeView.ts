// @harness-uid u_xxjw7sfoen
import { workOverview } from '$reports/components/projects-sessions/hub-home/hubHomeStatusText';
import type { OwnerHomeSnapshot } from '$reports/lib/projects-sessions/hub-home/hubHome.types';
import { homeProviderReadingIsStale } from '$reports/lib/projects-sessions/hub-home/homeProviderPayload';
import { listedHomeSnapshot } from '$reports/lib/projects-sessions/hub-home/homeDirectAgents';
import { homeBoard } from '$reports/components/projects-sessions/hub-home/hubHomeMerge';
import { soonestWork } from '$reports/components/projects-sessions/hub-home/hubHomePresentation';
import type { HomeView } from '$reports/components/projects-sessions/hub-home/hubHomeView.types';
import type { Workspace } from '../../lib/stores/projects-sessions/workspace.svelte';

const hubNotices = {
	fresh: '',
	offline: 'Showing saved Hub projects.',
	denied: 'Access to Hub projects was refused.',
	unavailable: 'Hub projects could not be loaded.'
};

export function desktopHomeView(
	home: OwnerHomeSnapshot | null,
	workspace: Pick<
		Workspace,
		| 'projects'
		| 'projectListReady'
		| 'busy'
		| 'switchProject'
		| 'hubProjectListStatus'
		| 'localProjectListFailed'
	>,
	settled: boolean,
	now: number
): HomeView {
	const tracker = trackerHome(home, settled, now);
	const notices = [
		hubNotices[workspace.hubProjectListStatus],
		workspace.localProjectListFailed ? 'Projects on this Mac could not be read.' : ''
	].filter(Boolean);
	return {
		...tracker,
		reminders: home?.reminders ?? null,
		controlled: [],
		projects: [],
		projectsFailed: false,
		native: {
			projects: workspace.projectListReady ? workspace.projects : null,
			projectBusy: workspace.busy,
			openProject: (id) => void workspace.switchProject(id),
			notices
		},
		trackerProjects: null,
		projectSnapshots: {},
		work: soonestWork(tracker.overview),
		owner: true,
		needsMac: false,
		linkedComputers: 0,
		computers: null,
		now
	};
}

function trackerHome(home: OwnerHomeSnapshot | null, settled: boolean, now: number) {
	if (!home) {
		const rows = settled ? [] : null;
		return {
			overview: settled ? { status: 'unavailable' as const } : null,
			agents: rows,
			openAsks: [],
			plans: rows,
			schedule: rows,
			pastDue: [],
			quota: rows,
			projectDirectory: [],
			trackerConnected: false,
			quotaConnected: false
		};
	}
	const { agents, openAsks } = listedHomeSnapshot(home);
	const { overview, plans, providers } = home;
	const routines =
		Array.isArray(providers.routines) && !homeProviderReadingIsStale(providers.routinesReadAt, now);
	const { upcoming, pastDue } = homeBoard(home, routines, now);
	return {
		overview: workOverview(overview, pastDue),
		agents,
		openAsks,
		plans,
		schedule: upcoming,
		pastDue,
		quota: providers.quota ?? [],
		projectDirectory: home.projectDirectory ?? [],
		trackerConnected: overview.status === 'ready',
		quotaConnected: Array.isArray(providers.quota)
	};
}
