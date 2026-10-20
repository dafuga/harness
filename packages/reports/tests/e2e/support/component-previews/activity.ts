import type { PreviewCases } from './shared';
import { stamp, row } from './shared';
import { commits } from '../../../../test/entityUnits';
const agent = {
	id: 'preview-agent',
	label: 'Preview agent',
	provider: null,
	model: null,
	worktree: 'Preview checkout',
	branch: 'main',
	task: 'Capture component states',
	loop: 'component-previews',
	units: [],
	unknownUnits: [],
	registeredAt: stamp,
	heartbeatAt: stamp,
	state: 'working',
	detail: 'Capturing component previews'
};
export const activity = {
	schemaVersion: 1,
	kind: 'live',
	repository: { name: 'Preview project', branch: 'main', head: commits.middle },
	asOf: { commit: commits.middle, committedAt: stamp },
	loops: {
		total: 1,
		types: [
			{
				template: 'feature',
				loops: 1,
				complete: 0,
				open: 1,
				lastUsedAt: stamp,
				names: ['component-previews']
			}
		]
	},
	work: [
		{
			commit: commits.middle,
			subject: 'feat: component previews',
			author: 'Fixture',
			committedAt: stamp,
			branches: ['main'],
			units: ['reports.component.activity-list'],
			reasons: [
				{ unit: 'reports.component.activity-list', behavior: 'Capture the component states.' }
			],
			reasonCount: 1,
			files: 1
		}
	],
	files: [
		{
			path: 'src/components/ActivityList.svelte',
			status: 'modified',
			commit: commits.middle,
			committedAt: stamp,
			units: ['reports.component.activity-list']
		}
	]
};
export const live = {
	sampledAt: stamp,
	worktrees: [
		{
			id: 'preview',
			name: 'Preview checkout',
			path: '/preview',
			branch: 'main',
			head: commits.middle,
			dirty: false,
			changes: []
		}
	],
	agents: { sampledAt: stamp, current: true, working: 1, registered: 1, roster: [agent] }
};
export const activityCases: PreviewCases = {
	'reports.component.activity-agents': { agents: live.agents, sampledAt: stamp },
	'reports.component.activity-files': {
		files: activity.files,
		worktrees: live.worktrees,
		href: () => '/history',
		registry: 'Current checkout'
	},
	'reports.component.activity-list': {
		items: [
			{ title: 'Review component states' },
			{ title: 'Capture screenshots' },
			{ title: 'Check keyboard navigation' },
			{ title: 'Confirm responsive layout' }
		],
		label: 'Recent activity',
		noun: 'activities',
		preview: 3,
		row
	},
	'reports.component.activity-loops': { loops: activity.loops },
	'reports.component.activity-work': { work: activity.work, href: () => '/history' },
	'reports.component.project-activity': { activity, live, base: '/harness' },
	'reports.component.site-activity': { shown: { activity, live } }
};
