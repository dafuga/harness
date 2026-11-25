import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createContext, runInContext } from 'node:vm';
import type {
	HomePlanState,
	HomeRun,
	HomeSubscription,
	OwnerHomeSnapshot
} from '../../../reports/src/lib/projects-sessions/hub-home/hubHome.types';
import type {
	OverviewCard,
	OverviewItem
} from '../../../reports/src/lib/projects-sessions/project-overview/projectOverview.types';
import { directAgentsOnly } from '../../../reports/src/lib/projects-sessions/hub-home/homeDirectAgents';
import type { HomeFixtureState, MockupHomeData } from './hub-home-fixture.types';

export const homeClock = Date.parse('2026-11-21T22:30:00.000Z');
const at = (minutes = 0) => new Date(homeClock + minutes * 60000).toISOString();

const fixtures = createContext({ window: {} });
runInContext("Object.defineProperty(globalThis, 'HH', { get: () => window.HH })", fixtures);
for (const name of ['data', 'data-work', 'data-busy', 'data-quota']) {
	const file = resolve(
		import.meta.dirname,
		'../../../../specification/designs/hub-home/mockup',
		name + '.js'
	);
	runInContext(readFileSync(file, 'utf8'), fixtures, { filename: file, timeout: 1000 });
}

export function mockup(state: HomeFixtureState): MockupHomeData {
	return fixtures.window.HH.data[
		state === 'loading' || state === 'unavailable' ? 'default' : state
	];
}

function workCards(data: MockupHomeData): OverviewCard[] {
	const cards = new Map<string, OverviewCard>();
	data.wip.forEach((item, index) => {
		const overdue = item.eta.startsWith('overdue');
		const details: OverviewItem = {
			id: `work-${index}`,
			title: item.title,
			status: item.status === 'Blocked' ? 'blocked' : 'in_progress',
			due: item.eta === 'no ETA' ? null : at(overdue ? -20 : index * 60 + 25),
			updatedAt: at(-20),
			live: !overdue,
			stale: false
		};
		const card = cards.get(item.project) ?? {
			agent: item.project,
			state: 'active',
			liveSessions: 0,
			counts: { open: 0, in_progress: 0, blocked: 0, done: 0 },
			items: [],
			blocked: null,
			attention: null,
			milestone: null,
			updatedAt: at(-20)
		};
		card.items.push(details);
		card.counts[details.status]++;
		card.liveSessions += Number(details.live);
		if (item.status === 'Needs you') {
			card.state = 'needs-you';
			card.attention = { item: details, text: 'Approve the Nudge production window, Sat 09:00?' };
		}

		if (item.status === 'Blocked' && card.state !== 'needs-you') {
			card.state = 'blocked';
			card.blocked = { item: details, text: 'Waiting for the synthetic signing fixture' };
		}
		cards.set(item.project, card);
	});
	if (cards.size)
		cards.set('iOS pairing', {
			agent: 'iOS pairing',
			state: 'done',
			liveSessions: 0,
			counts: { open: 0, in_progress: 0, blocked: 0, done: 1 },
			items: [],
			blocked: null,
			attention: null,
			milestone: { text: 'Pairing polish finished.', at: at(-900) },
			updatedAt: at(-900)
		});
	return [...cards.values()];
}

const planState: Record<string, HomePlanState> = {
	draft: 'draft',
	review: 'in-review',
	approved: 'approved',
	active: 'in-progress',
	done: 'done'
};

function scheduled(data: MockupHomeData): HomeRun[] {
	return data.scheduled.map((run, index) => {
		const days =
			run.day === 'Today' ? 0 : run.day === 'Tomorrow' ? 1 : run.day.startsWith('Mon') ? 2 : 10;
		const [hours, minutes] = run.time.split(':').map(Number);
		return {
			id: `run-${index}`,
			title: run.title,
			agent: run.agent,
			machine: run.machine,
			at: at(days * 1440 + hours * 60 + minutes - 1350),
			source: index % 3 === 1 ? 'claude' : 'tracker',
			recurring: run.repeat !== 'Once',
			paused: Boolean(run.paused)
		};
	});
}

function quotas(data: MockupHomeData): HomeSubscription[] {
	return data.quota.map((sub, index) => ({
		id: `subscription-${index}`,
		provider: sub.provider === 'Claude Code' ? 'claude' : 'codex',
		plan: sub.plan,
		account: sub.account,
		readAt: at(sub.stale ? -180 : -2),
		limits: sub.limits.map((limit, pos) => ({
			id: `limit-${pos}`,
			label: limit.label,
			left: limit.left,
			resetsAt: at(pos ? 3600 : 85)
		})),
		credits: sub.credits?.left ?? null,
		history: sub.history.map((used, pos) => ({ day: at((pos - 6) * 1440).slice(0, 10), used })),
		agents: sub.top.map(([name, usage]) => ({ name, description: `${usage}%` }))
	}));
}

function agents(data: MockupHomeData): OwnerHomeSnapshot['agents'] {
	const all: OwnerHomeSnapshot['agents'] = data.agents.map((agent, index) => ({
		// The Mac publishes every Tracker project as an agent keyed by its Tracker agent value.
		id: agent.name === 'Chief of Staff' ? 'cos' : `agent-${index}`,
		name: agent.name,
		state: agent.state,
		sessions: agent.state === 'working' ? 1 : 0,
		tasks: [],
		subAgents: { sessions: 0, tasks: [] },
		since: at(-15),
		itemId: agent.state === 'offline' ? null : `item-${index}`,
		task: agent.task,
		machine: agent.machine,
		model: agent.model,
		question:
			agent.state === 'needs-you' ? 'Approve the Nudge production window, Sat 09:00?' : null,
		...(agent.state === 'needs-you' && {
			options: [
				{
					label: 'Approve Saturday 09:00',
					effect: 'Schedules the production deploy for Saturday at 09:00.',
					recommended: true as const
				},
				{ label: 'Move to Monday', effect: 'Holds the deploy until Monday morning.' }
			],
			confirm: 'deploy' as const
		}),
		messages:
			agent.state === 'needs-you'
				? [
						{
							id: 'question',
							from: 'agent',
							text: 'Staging calls passed. Approve the Nudge production window, Sat 09:00?',
							at: at(-4)
						},
						{
							id: 'reply',
							from: 'you',
							text: 'Does staging include the voicemail path?',
							at: at(-2)
						},
						{
							id: 'followup',
							from: 'agent',
							text: 'Yes, voicemail and carrier-busy passed.',
							at: at(-1)
						}
					]
				: []
	}));
	// The Hub lists only the agents Daniel talks to; the rest become sub-agent session counts.
	return directAgentsOnly(all);
}

export function homeData(data: MockupHomeData): OwnerHomeSnapshot {
	const projects = workCards(data);
	const schedule = scheduled(data);
	return {
		overview: {
			status: 'ready',
			machines: data.machines,
			projects,
			liveSessions: projects.reduce((sum, project) => sum + project.liveSessions, 0)
		},
		agents: agents(data),
		plans: data.plans.map((plan, index) => ({
			id: `plan-${index}`,
			title: plan.title,
			project: plan.project,
			state: planState[plan.status],
			updatedAt: at(-20),
			done: plan.done,
			total: plan.steps,
			steps: [
				'Review current behavior',
				'Implement the approved design',
				'Verify all viewports',
				'Record evidence'
			].map((title, pos) => ({ id: `step-${pos}`, title, done: pos < plan.done }))
		})),
		scheduled: schedule,
		providers: {
			routines: schedule.filter((run) => run.source === 'claude'),
			routinesReadAt: at(-2),
			quota: quotas(data)
		}
	};
}
