import { expect, test, vi } from 'vitest';
import {
	buildHomeSnapshot,
	noProviders
} from '../../../reports/src/lib/projects-sessions/hub-home/homeTrackerProjection';
import { listHomeAgents } from '../../../reports/src/lib/projects-sessions/hub-home/homeDirectAgents';
import { readTrackerSources } from '../../../reports/src/lib/projects-sessions/project-overview/projectOverviewTracker';
import type { TrackerItemRecord } from '../../../reports/src/lib/projects-sessions/project-overview/projectOverviewTracker.types';
import { deliverHomeChat } from '../../../desktop/src/lib/development-tooling/desktop-initialization/tracker-overview-publisher/homeTrackerChat';
import {
	soonestWork,
	warningFor
} from '../../../reports/src/components/projects-sessions/hub-home/hubHomePresentation';

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
/** The fields of an open structured ask, the only flag Home treats as needing Daniel. */
const flaggedAsk = {
	needs_daniel: true,
	question,
	options: [
		{ label: 'Yes', effect: '', recommended: true as const },
		{ label: 'No', effect: '' }
	]
};

test('Tracker plan artifacts, children, due items, current question and privacy survive projection', async () => {
	const planning = {
		promotions: [],
		artifacts: {
			design: {
				summary: 'Fixture design',
				links: [{ kind: 'image', label: 'Mockup', url: 'https://design.example.test/plan.png' }]
			}
		}
	};
	const work = { ...base, parent: plan.id, ...flaggedAsk };
	const completed = { ...base, id: 'step-two', parent: plan.id, status: 'done' as const };
	const sensitive = { ...base, id: 'hidden', parent: plan.id, sensitive: true };
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
	const fetcher = vi
		.fn<typeof fetch>()
		.mockImplementation(async (url) =>
			Response.json(
				String(url).includes('/items?')
					? [{ ...plan, stage: 'design', planning }, work, completed, sensitive]
					: []
			)
		);
	const sources = await readTrackerSources(fetcher, true);
	const home = buildHomeSnapshot(
		sources,
		{ ...noProviders, routines: [routine], routinesReadAt: updated_at },
		now
	);
	expect(home.plans).toMatchObject([
		{ id: plan.id, total: 2, done: 1, state: 'draft', stage: 'design', planning }
	]);
	// The in-progress task is Work in progress, not a scheduled start.
	// The synthetic plan belongs to the Chief of Staff, whose list stays off the schedule.
	expect(home.scheduled.map((entry) => entry.id)).toEqual(['routine']);
	expect(home.overdue).toEqual([]);
	expect(listHomeAgents(home.agents).agents).toMatchObject([
		{ name: 'Chief of Staff', itemId: base.id, question }
	]);
	expect(soonestWork(home.overview)).toMatchObject([{ id: base.id }]);
	expect(JSON.stringify(home)).not.toContain('"hidden"');
	expect([9, 10, 24, 25].map(warningFor)).toEqual(['critical', 'low', 'low', null]);
});

test('native chat refuses an outdated question and calls only the fixed Tracker answer route', async () => {
	const work = { ...base, ...flaggedAsk };
	const home = buildHomeSnapshot({ items: [work], runs: [], machines: [] }, noProviders, now);
	const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 200 }));
	const input = {
		id: 'message-1',
		agentId: base.agent,
		itemId: base.id,
		question,
		kind: 'answer' as const,
		text: 'Yes'
	};
	expect(await deliverHomeChat({ ...input, question: 'Prior question' }, home, fetcher)).toEqual({
		id: input.id,
		status: 'refused'
	});
	expect(fetcher).not.toHaveBeenCalled();
	expect(await deliverHomeChat(input, home, fetcher)).toEqual({ id: input.id, status: 'sent' });
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

test('only Chief of Staff is an agent: every other project is a sub-agent counted under it', () => {
	const run = (id: number, item_id: string, node: string) => ({
		id,
		node,
		item_id,
		state: 'running',
		ended_at: null
	});
	const chief = { ...base, id: 'chief', agent: 'cos' };
	const flagged = { ...base, id: 'flagged', agent: 'flagged', ...flaggedAsk };
	const live = { ...base, id: 'live', agent: 'flagged' };
	const touched = { ...base, id: 'touched', agent: 'touched' };
	const away = { ...base, id: 'away', agent: 'away' };
	const archived = {
		...base,
		id: 'archived',
		agent: 'archived-agent',
		project: 'Archived project',
		status: 'done' as const,
		updated_at: '2020-01-01T00:00:00.000Z'
	};
	const privateItem = { ...archived, id: 'private', project: 'Private project', sensitive: true };
	const home = buildHomeSnapshot(
		{
			items: [chief, flagged, live, touched, away, archived, privateItem],
			runs: [
				run(1, 'live', 'primary'),
				run(2, 'flagged', 'second'),
				{ ...run(3, 'touched', 'primary'), state: 'finished', ended_at: 5 },
				run(4, 'away', 'gone')
			],
			machines: [{ node: 'gone', status: 'offline' }]
		},
		noProviders,
		now
	);
	const listed = listHomeAgents(home.agents);
	expect(home.projectDirectory).toEqual(
		expect.arrayContaining([
			{ name: 'flagged', state: 'needs-you', needsYou: 1 },
			{ name: 'Archived project', state: 'done', needsYou: 0 }
		])
	);
	expect(home.projectDirectory?.some(({ name }) => name === 'Private project')).toBe(false);
	expect(listed.agents.map((agent) => agent.name)).toEqual(['Chief of Staff']);
	expect(listed.asks).toMatchObject([{ id: 'flagged', state: 'needs-you', question }]);
	const [chiefOfStaff] = listed.agents;
	expect(chiefOfStaff).toMatchObject({ id: 'cos', sessions: 0, state: 'working' });
	expect(chiefOfStaff.subAgents.sessions).toBe(2);
	expect(chiefOfStaff.subAgents.tasks.map((task) => task.itemId).sort()).toEqual([
		'flagged',
		'live'
	]);
	expect(JSON.stringify(listed)).not.toContain('touched');
	expect(soonestWork(home.overview).map((item) => item.id)).toContain('touched');
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
	const mine = { ...base, id: 'mine', agent: 'mine', ...flaggedAsk };
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
