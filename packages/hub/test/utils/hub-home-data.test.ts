import { expect, test, vi } from 'vitest';
import {
	buildHomeSnapshot,
	noProviders
} from '../../../reports/src/lib/projects-sessions/hub-home/homeTrackerProjection';
import { listHomeAgents } from '../../../reports/src/lib/projects-sessions/hub-home/homeDirectAgents';
import type { TrackerItemRecord } from '../../../reports/src/lib/projects-sessions/project-overview/projectOverviewTracker.types';
import { deliverHomeChat } from '../../../desktop/src/lib/development-tooling/desktop-initialization/tracker-overview-publisher/homeTrackerChat';
import {
	agentSessions,
	isWorking,
	soonestWork,
	warningFor
} from '../../../reports/src/components/projects-sessions/hub-home/hubHomePresentation';
import {
	readRecordedHomeTracker,
	trackerHomeClock,
	trackerHomeRecording
} from '../support/hubHomeTrackerRecording';

const now = Date.parse('2026-11-21T22:30:00Z');
const updated_at = new Date(now).toISOString();
const base = {
	id: 'task-one',
	title: 'Synthetic work',
	status: 'in_progress' as const,
	agent: 'cos',
	updated_at,
	due: '2026-11-21T23:30:00Z'
};
const plan: TrackerItemRecord = { ...base, id: 'plan-one', kind: 'plan', status: 'open' };
const question = 'Can we use the synthetic example?';

test('Tracker plan children, due items, current question and privacy survive projection', () => {
	const work = { ...base, parent: plan.id, needs_daniel: true, question };
	const completed = { ...base, id: 'step-two', parent: plan.id, status: 'done' as const };
	const sensitive = {
		...base,
		id: 'hidden',
		parent: plan.id,
		project: 'Private project',
		sensitive: true
	};
	const routine = {
		id: 'routine',
		title: 'Synthetic routine',
		at: '2026-11-21T23:00:00.000Z',
		agent: null,
		machine: 'Claude cloud',
		source: 'claude' as const,
		recurring: true,
		paused: false
	};
	const home = buildHomeSnapshot(
		{ items: [plan, work, completed, sensitive], runs: [], machines: [] },
		{ ...noProviders, routines: [routine], routinesReadAt: updated_at },
		now
	);
	expect(home.plans).toMatchObject([{ id: plan.id, total: 2, done: 1, state: 'draft' }]);
	expect(home.scheduled.map((entry) => entry.id)).toEqual(['routine', 'plan-one', 'task-one']);
	expect(listHomeAgents(home.agents).agents).toMatchObject([
		{ name: 'Chief of Staff', itemId: base.id, question }
	]);
	expect(soonestWork(home.overview)).toMatchObject([{ id: base.id }]);
	expect(JSON.stringify(home)).not.toContain('"hidden"');
	expect(home.projectDirectory?.some(({ name }) => name === 'Private project')).toBe(false);
	expect([9, 10, 24, 25].map(warningFor)).toEqual(['critical', 'low', 'low', null]);
});

test('native chat refuses an outdated question and calls only the fixed Tracker answer route', async () => {
	const work = { ...base, needs_daniel: true, question };
	const { agents } = buildHomeSnapshot({ items: [work], runs: [], machines: [] }, noProviders, now);
	const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 200 }));
	const input = {
		id: 'message-1',
		agentId: base.agent,
		itemId: base.id,
		question,
		kind: 'answer' as const,
		text: 'Yes'
	};
	expect(await deliverHomeChat({ ...input, question: 'Prior question' }, agents, fetcher)).toEqual({
		id: input.id,
		status: 'refused'
	});
	expect(fetcher).not.toHaveBeenCalled();
	expect(await deliverHomeChat(input, agents, fetcher)).toEqual({ id: input.id, status: 'sent' });
	expect(fetcher).toHaveBeenCalledOnce();
	expect(fetcher).toHaveBeenCalledWith(
		'http://127.0.0.1:7701/items/task-one/answer',
		expect.objectContaining({
			method: 'POST',
			redirect: 'error',
			credentials: 'omit',
			body: JSON.stringify({ answer: 'Yes', by: 'Daniel via Hub' })
		})
	);
});

test('Home working sessions match live Tracker runs even when their projects have open asks', async () => {
	const sources = await readRecordedHomeTracker();
	const home = buildHomeSnapshot(sources, noProviders, trackerHomeClock);
	const listed = listHomeAgents(home.agents);

	const responses = trackerHomeRecording.responses;
	const offline = new Set(
		responses['/machines']
			.filter((machine) => machine.status === 'offline')
			.map((machine) => machine.node)
	);
	const liveRuns = responses['/runs?limit=500'].filter(
		(run) => run.state === 'running' && run.ended_at === null && !offline.has(run.node)
	);
	expect(liveRuns).toHaveLength(3);
	const workingSessions = listed.agents
		.filter(isWorking)
		.reduce((total, agent) => total + agentSessions(agent), 0);
	expect(workingSessions).toBe(liveRuns.length);
	expect(home.overview).toMatchObject({ liveSessions: liveRuns.length });
	expect(listed.agents.map((agent) => agent.name)).toEqual(['Chief of Staff']);
	expect(home.openAsks).toEqual(
		expect.arrayContaining([
			expect.objectContaining({ agentId: 'harbor', itemId: 'harbor-ask', question: 'Ship harbor?' })
		])
	);
	expect(home.projectDirectory).toEqual(
		expect.arrayContaining([
			{ name: 'harbor', state: 'needs-you', needsYou: 1 },
			{ name: 'mine', state: 'quiet', needsYou: 0 },
			{ name: 'iOS pairing', state: 'done', needsYou: 0 }
		])
	);
	expect(soonestWork(home.overview).map(({ id }) => id)).toContain('quiet-history');

	expect(listed.agents[0]).toMatchObject({
		id: 'cos',
		itemId: 'item-0',
		state: 'needs-you',
		sessions: 2,
		tasks: [{ itemId: 'cos-live' }],
		subAgents: { sessions: 1, tasks: [{ itemId: 'harbor-live' }] }
	});
	expect(home.overview).toMatchObject({
		projects: expect.arrayContaining([
			expect.objectContaining({ agent: 'mine', state: 'quiet', liveSessions: 0 }),
			expect.objectContaining({ agent: 'iOS pairing', state: 'done', liveSessions: 0 })
		])
	});
	expect(
		home.agents
			.filter((agent) => agent.sessions === 0)
			.map((agent) => agent.id)
			.sort()
	).toEqual(['Offline delivery', 'Tracker keeper', 'iOS pairing', 'mine']);
});

test('no sub-agent sessions and no Chief of Staff gives no agents, and an idle Chief stays idle', () => {
	const chief = { ...base, id: 'chief', agent: 'cos' };
	const other = { ...base, id: 'other', agent: 'other' };
	const none = buildHomeSnapshot({ items: [other], runs: [], machines: [] }, noProviders, now);
	expect(listHomeAgents(none.agents).agents).toEqual([]);
	const idle = buildHomeSnapshot(
		{ items: [chief, other], runs: [], machines: [] },
		noProviders,
		now
	);
	const [chiefOfStaff] = listHomeAgents(idle.agents).agents;
	expect(chiefOfStaff).toMatchObject({ name: 'Chief of Staff', state: 'idle' });
	expect(chiefOfStaff.subAgents).toEqual({ sessions: 0, tasks: [] });
});

test('a session Daniel adds is listed, and no longer folded or asked about', () => {
	const chief = { ...base, id: 'chief', agent: 'cos' };
	const mine = { ...base, id: 'mine', agent: 'mine', needs_daniel: true, question };
	const home = buildHomeSnapshot(
		{ items: [chief, mine], runs: [], machines: [] },
		noProviders,
		now
	);
	expect(listHomeAgents(home.agents).asks).toMatchObject([{ id: 'mine' }]);
	const listed = listHomeAgents(home.agents, ['mine']);
	expect(listed.agents.map((agent) => agent.id).sort()).toEqual(['cos', 'mine']);
	expect(listed.asks).toEqual([]);
});

test('an open ask carries its options and confirm kind; a closed ask or malformed options carry none', () => {
	const options = [
		{ label: 'Ship it', effect: 'Merges the change.', recommended: true as const },
		{ label: 'Wait', effect: '' }
	];
	const asked = { ...base, needs_daniel: true, question, options, confirm: 'deploy' as const };
	const project = (item: TrackerItemRecord) =>
		buildHomeSnapshot({ items: [item], runs: [], machines: [] }, noProviders, now).agents[0];
	expect(project(asked)).toMatchObject({ question, options, confirm: 'deploy' });
	expect(project({ ...asked, resolved: true })).not.toHaveProperty('options');
	expect(project({ ...asked, options: options.slice(0, 1) })).not.toHaveProperty('options');
});
