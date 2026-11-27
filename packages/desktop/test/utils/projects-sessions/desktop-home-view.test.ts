import { expect, test, vi } from 'vitest';
import { desktopHomeView } from '../../../src/utils/projects-sessions/desktopHomeView';
import { buildHomeSnapshot } from '$reports/lib/projects-sessions/hub-home/homeTrackerProjection';

test('a Tracker and Hub outage leaves the local workspace available', () => {
	const switchProject = vi.fn();
	const projects = [{ id: 'local-alpha', name: 'Alpha', kind: 'local' as const }];
	const view = desktopHomeView(
		null,
		{
			projects,
			projectListReady: true,
			busy: false,
			switchProject,
			hubProjectListStatus: 'unavailable',
			localProjectListFailed: false
		},
		true,
		0
	);

	expect(view.trackerConnected).toBe(false);
	expect(view.native?.notices).toEqual(['Hub projects could not be loaded.']);
	expect(view.native?.projects).toEqual(projects);
	view.native?.openProject('local-alpha');
	expect(switchProject).toHaveBeenCalledWith('local-alpha');
});

const idleWorkspace = {
	projects: [],
	projectListReady: true,
	busy: false,
	switchProject: vi.fn(),
	hubProjectListStatus: 'fresh' as const,
	localProjectListFailed: false
};

test('the signed-in Mac Home lists the personal reminders in its Tracker reading', () => {
	const providers = { quota: null, routines: null, routinesReadAt: null };
	const reminder = {
		itemId: 'walkthedog',
		title: 'Walk the sample dog',
		at: '2026-11-28T09:00:00.000Z',
		repeats: null,
		updatedAt: '2026-11-27T09:00:00.000Z'
	};
	const home = { ...buildHomeSnapshot(null, providers, 0), reminders: [reminder] };

	const view = desktopHomeView(home, idleWorkspace, true, 0);

	expect(view.reminders).toEqual([reminder]);
	expect(view.openAsks).toEqual([]);
	expect(desktopHomeView(null, idleWorkspace, true, 0).reminders).toBeNull();
});
