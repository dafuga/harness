import { allStatesSnapshot, NOW } from '../projectOverviewFixture';
import { soonestWork } from '../../../../../hub/src/components/projects-sessions/hubHomePresentation';
import type { HomeView } from '../../../../../hub/src/components/projects-sessions/hubHomeView.types';
import type { OwnerHomeSnapshot } from '../../../../src/lib/projects-sessions/hub-home/hubHome.types';

const prefix = 'hub.component.projects-sessions-hub-';
export function isHubHomePreview(id: string) {
	return id.startsWith(prefix + 'home') || id === prefix + 'quota-subscription';
}

function stamp(hours: number) {
	return new Date(NOW + hours * 3_600_000).toISOString();
}

const snapshot: OwnerHomeSnapshot = {
	overview: allStatesSnapshot(),
	agents: [
		{
			id: 'atlas',
			name: 'Atlas',
			state: 'needs-you',
			itemId: 'ITEM-A1',
			task: 'Choose the export column names',
			machine: 'preview-mac',
			model: 'Codex',
			since: stamp(-1),
			question: 'Should the export retain the old column names?',
			messages: []
		},
		{
			id: 'cinder',
			name: 'Cinder',
			state: 'working',
			itemId: 'ITEM-C3',
			task: 'Write the upstream timeout test',
			machine: 'preview-mac',
			model: 'Claude',
			since: stamp(-1),
			question: null,
			messages: []
		}
	],
	plans: [
		{
			id: 'plan-export',
			title: 'Prepare the export cutover',
			project: 'Atlas',
			state: 'in-progress',
			updatedAt: stamp(-1),
			total: 2,
			done: 1,
			steps: [
				{ id: 'test', title: 'Record fixtures', done: true },
				{ id: 'review', title: 'Review exported columns', done: false }
			]
		}
	],
	scheduled: [
		{
			id: 'timeout',
			title: 'Review the timeout suite',
			at: stamp(8),
			agent: 'Cinder',
			machine: 'preview-mac',
			source: 'tracker',
			recurring: false,
			paused: false
		}
	],
	providers: {
		routines: [],
		routinesReadAt: stamp(-0.25),
		quota: [
			{
				id: 'codex',
				provider: 'codex',
				plan: 'Pro',
				account: 'Example account',
				readAt: stamp(-0.25),
				limits: [{ id: 'session', label: '5-hour window', left: 18, resetsAt: stamp(4) }],
				credits: null,
				history: [40, 68, 32, 73, 42, 57, 82].map((used, index) => ({
					day: stamp((index - 6) * 24).slice(0, 10),
					used
				})),
				agents: [{ name: 'Atlas', description: 'Checking export compatibility' }]
			}
		]
	}
};

export const catalogHome = { granted: true, snapshot };

export const catalogHomeView: HomeView = {
	overview: snapshot.overview,
	agents: snapshot.agents,
	plans: snapshot.plans,
	schedule: snapshot.scheduled,
	quota: snapshot.providers.quota,
	projects: [],
	projectsFailed: false,
	trackerProjects: null,
	projectSnapshots: {},
	work: soonestWork(snapshot.overview),
	owner: true,
	needsMac: false,
	trackerConnected: true,
	routinesConnected: true,
	quotaConnected: true,
	now: NOW
};
