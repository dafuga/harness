import type { PreviewCases } from './shared';
import { noop, stamp, row } from './shared';
import { activityWorkPreview } from './activityWorkVariants';
import { activityFilesPreview } from './activityFileVariants';
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
	'reports.component.activity-agents': { agents: live.agents, sampledAt: stamp },
	'reports.component.activity-files': {
		files: activityFilesPreview(activity.files),
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
	'reports.component.activity-work': {
		work: activityWorkPreview(activity.work),
		href: () => '/history'
	},
	'reports.component.project-activity': { activity, live, base: '/harness' },
	'reports.component.site-activity': { shown: { activity, live } }
};

const agentStates: Record<string, () => PreviewCases[string]> = {
	unavailable: () => ({ agents: null, sampledAt: stamp }),
	'tracking-never-used': () => ({
		agents: { tracking: 'never-used', working: null, unreadable: 0, roster: [] },
		sampledAt: stamp
	}),
	stale: () => ({
		agents: {
			...live.agents,
			working: 1,
			roster: [{ ...agent, state: 'stale', detail: 'Last heartbeat is older than the allowance.' }]
		},
		sampledAt: stamp,
		reading: { now: Date.parse(stamp) + 61_000, failed: false, refresh: noop }
	}),
	'failed-read': () => ({
		agents: live.agents,
		sampledAt: stamp,
		reading: { now: Date.parse(stamp), failed: true, refresh: noop }
	}),
	unreadable: () => ({
		agents: { ...live.agents, unreadable: 2 },
		sampledAt: stamp
	})
};

const loopStates: Record<string, () => PreviewCases[string]> = {
	empty: () => ({ loops: { total: 0, types: [] } })
};

const projectActivityStates: Record<string, () => PreviewCases[string]> = {
	recorded: () => ({ activity: { ...activity, kind: 'recorded' }, live: null, base: '/harness' }),
	empty: () => ({
		activity: { ...activity, work: [], files: [], loops: { total: 0, types: [] } },
		live: {
			...live,
			worktrees: [],
			agents: { tracking: 'never-used', working: null, unreadable: 0, roster: [] }
		},
		base: '/harness'
	})
};

export function activityVariant(id: string, variant: string, props: PreviewCases[string]) {
	const states =
		id === 'reports.component.activity-agents'
			? agentStates
			: id === 'reports.component.activity-loops'
				? loopStates
				: id === 'reports.component.project-activity'
					? projectActivityStates
					: undefined;
	return states?.[variant]?.() ?? props;
}
