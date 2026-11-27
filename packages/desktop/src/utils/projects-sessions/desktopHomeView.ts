// @harness-uid u_xxjw7sfoen
import type { OwnerHomeSnapshot } from '$reports/lib/projects-sessions/hub-home/hubHome.types';
import { homeProviderReadingIsStale } from '$reports/lib/projects-sessions/hub-home/homeProviderPayload';
import { listedHomeSnapshot } from '$reports/lib/projects-sessions/hub-home/homeDirectAgents';
import { homeBoard } from '../../../../hub/src/components/projects-sessions/hubHomeMerge';
import { soonestWork } from '../../../../hub/src/components/projects-sessions/hubHomePresentation';
import type { HomeView } from '../../../../hub/src/components/projects-sessions/hubHomeView.types';
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
	const overview = home?.overview ?? (settled ? { status: 'unavailable' as const } : null);
	const listed = home ? listedHomeSnapshot(home) : null;
	const routines =
		Array.isArray(home?.providers.routines) &&
		!homeProviderReadingIsStale(home.providers.routinesReadAt, now);
	const board = home && homeBoard(home, routines, now);
	const notices = [
		hubNotices[workspace.hubProjectListStatus],
		workspace.localProjectListFailed ? 'Projects on this Mac could not be read.' : ''
	].filter(Boolean);
	return {
		overview,
		agents: listed?.agents ?? (settled ? [] : null),
		openAsks: listed?.openAsks ?? [],
		controlled: [],
		plans: home?.plans ?? (settled ? [] : null),
		schedule: board?.upcoming ?? (settled ? [] : null),
		pastDue: board?.pastDue ?? [],
		quota: home?.providers.quota ?? (settled ? [] : null),
		projects: [],
		projectsFailed: false,
		projectDirectory: home?.projectDirectory ?? [],
		native: {
			projects: workspace.projectListReady ? workspace.projects : null,
			projectBusy: workspace.busy,
			openProject: (id) => void workspace.switchProject(id),
			notices
		},
		trackerProjects: null,
		projectSnapshots: {},
		work: soonestWork(overview),
		owner: true,
		needsMac: false,
		linkedComputers: 0,
		computers: null,
		trackerConnected: overview?.status === 'ready',
		quotaConnected: Array.isArray(home?.providers.quota),
		now
	};
}
