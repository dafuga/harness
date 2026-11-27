import { allStatesSnapshot, NOW } from '../projectOverviewFixture';
import { catalogReminders, catalogStamp as stamp } from './hubHomeReminderData';
import { soonestWork } from '../../../../src/components/projects-sessions/hub-home/hubHomePresentation';
import type { HomeView } from '../../../../src/components/projects-sessions/hub-home/hubHomeView.types';
import type { LinkedHome } from '../../../../../hub/src/services/networking-security/LinkedHomeService';
import type { HomeWorkProject } from '../../../../src/lib/projects-sessions/hub-home/homeLive.types';
import type {
	OwnerHomeSnapshot,
	TrackerHomeSource
} from '../../../../src/lib/projects-sessions/hub-home/hubHome.types';
import { previewAnswerOptions } from './shared';

const prefix = 'hub.component.projects-sessions-hub-';
export function isHubHomePreview(id: string) {
	return id.startsWith(prefix + 'home') || id === prefix + 'quota-subscription';
}

const snapshot: OwnerHomeSnapshot = {
	overview: allStatesSnapshot(),
	agents: [
		{
			id: 'atlas',
			name: 'Atlas',
			state: 'needs-you',
			sessions: 0,
			tasks: [],
			subAgents: { sessions: 0, tasks: [] },
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
			sessions: 1,
			tasks: [{ itemId: 'ITEM-LIVE', title: 'Live task', machine: 'preview-mac' }],
			subAgents: { sessions: 0, tasks: [] },
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
			stage: 'design',
			planning: {
				promotions: [],
				artifacts: {
					design: {
						summary: 'Review the export columns and empty states.',
						links: [{ label: 'Export design canvas', url: 'https://design.example.test/export' }]
					}
				}
			},
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

export const catalogWorkProject: HomeWorkProject = {
	agent: 'Atlas',
	running: 1,
	counts: { open: 2, in_progress: 1, blocked: 1, done: 4 },
	updatedAt: stamp(-0.1),
	rows: [
		{
			key: 'run:preview-mac:1',
			itemId: 'ITEM-LIVE',
			title: 'Prepare the export cutover',
			state: 'running',
			outcome: null,
			status: 'in_progress',
			stage: 'build',
			now: 'PR open; full check running, merge follows a pass.',
			owner: 'Export session',
			computer: 'preview-mac',
			model: 'sample-model:high',
			startedAt: stamp(-0.2),
			updatedAt: stamp(-0.1)
		}
	]
};

/** One linked computer that answered with the live overview. */
const catalogComputers: LinkedHome = {
	linked: 1,
	answered: 1,
	snapshot: {
		...snapshot,
		liveOverview: {
			readAt: stamp(0),
			projects: [catalogWorkProject],
			machines: [],
			hiddenRuns: 0,
			omittedRows: 0
		}
	}
};

export const catalogHome = { granted: true, snapshot };

export const catalogDesktopHome: OwnerHomeSnapshot = {
	overview: { status: 'ready', projects: [], machines: [], liveSessions: 0 },
	projectDirectory: [
		{ name: 'Orders', state: 'needs-you', needsYou: 1 },
		{ name: 'Atlas', state: 'quiet', needsYou: 0 }
	],
	openAsks: [
		{
			itemId: 'ITEM-A1',
			agentId: 'orders',
			agentName: 'Orders',
			title: 'Review the export headings',
			question: 'Which column names should we use?',
			options: previewAnswerOptions,
			since: stamp(-1)
		}
	],
	agents: [],
	plans: snapshot.plans,
	scheduled: [],
	providers: { routines: [], quota: snapshot.providers.quota }
};

/** Browser notifications offered, with no browser subscribed yet. */
export const catalogPush = {
	available: true,
	publicKey: 'sample-public-key',
	quiet: { enabled: true, start: '22:00', end: '08:00' },
	browsers: []
};

export const catalogHomeView: HomeView = {
	overview: snapshot.overview,
	agents: snapshot.agents,
	openAsks: [],
	reminders: catalogReminders,
	controlled: [],
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
	linkedComputers: 1,
	computers: catalogComputers,
	trackerConnected: true,
	pastDue: [],
	quotaConnected: true,
	now: NOW
};

export const catalogTrackerHomeSource: TrackerHomeSource = {
	read: async () => ({
		...snapshot,
		scheduled: snapshot.scheduled.map((run) => ({
			...run,
			at: new Date(Date.now() + 8 * 3_600_000).toISOString()
		}))
	}),
	send: async ({ id }) => ({ id, status: 'sent' })
};
