import { expect, test, vi } from 'vitest';
import { desktopHomeView } from '../../../src/utils/projects-sessions/desktopHomeView';

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
