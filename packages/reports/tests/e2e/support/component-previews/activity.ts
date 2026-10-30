import type { PreviewCases } from './shared';
import { stamp, row } from './shared';
const activityCommit = 'b04e19f52a61c374d8f090b8a3e67c12451fd903';
const agent = {
	id: 'preview-agent',
	label: 'Preview agent',
	provider: 'openai',
	model: 'gpt-6.1-terra',
	worktree: 'Preview checkout',
	branch: 'main',
	task: 'Capture component states',
	loop: 'component-previews',
	units: ['reports.component.activity-agents'],
	unknownUnits: [],
	registeredAt: stamp,
	heartbeatAt: stamp,
	expiresAt: '2026-10-20T10:05:00Z',
	state: 'working',
	detail: 'Capturing component previews'
};
export const activity = {
	schemaVersion: 1,
	kind: 'live',
	repository: { name: 'Preview project', branch: 'main', head: activityCommit },
	asOf: { commit: activityCommit, committedAt: stamp },
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
			commit: activityCommit,
			subject: 'feat: component previews',
			author: 'Fixture',
			committedAt: stamp,
			branches: ['main'],
			units: ['reports.component.activity-list'],
			unitCount: 1,
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
			commit: activityCommit,
			committedAt: stamp,
			units: ['reports.component.activity-list']
		}
	]
};
export const live = {
	sampledAt: stamp,
	worktrees: [
		{
			name: 'Preview checkout',
			branch: 'main',
			head: activityCommit,
			primary: true,
			changes: [
				{
					path: 'src/components/ActivityList.svelte',
					status: 'modified',
					units: ['reports.component.activity-list']
				}
			],
			truncated: false
		}
	],
	agents: { tracking: 'available', working: 1, unreadable: 0, roster: [agent] }
};
export const activityCases: PreviewCases = {
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
	}
};
