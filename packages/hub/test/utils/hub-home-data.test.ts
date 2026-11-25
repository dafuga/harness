import { expect, test, vi } from 'vitest';
import {
	buildHomeSnapshot,
	noProviders
} from '../../../reports/src/lib/projects-sessions/hub-home/homeTrackerProjection';
import type { TrackerItemRecord } from '../../../reports/src/lib/projects-sessions/project-overview/projectOverviewTracker.types';
import { deliverHomeChat } from '../../../desktop/src/lib/development-tooling/desktop-initialization/tracker-overview-publisher/homeTrackerChat';
import {
	soonestWork,
	warningFor
} from '../../src/components/projects-sessions/hubHomePresentation';

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
	const home = buildHomeSnapshot(
		{ items: [plan, work, completed, sensitive], runs: [], machines: [] },
		{ ...noProviders, routines: [routine], routinesReadAt: updated_at },
		now
	);
	expect(home.plans).toMatchObject([{ id: plan.id, total: 2, done: 1, state: 'draft' }]);
	expect(home.scheduled.map((entry) => entry.id)).toEqual(['routine', 'plan-one', 'task-one']);
	expect(home.agents).toMatchObject([{ name: 'Chief of Staff', itemId: base.id, question }]);
	expect(soonestWork(home.overview)).toMatchObject([{ id: base.id }]);
	expect(JSON.stringify(home)).not.toContain('"hidden"');
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

test('only Chief of Staff is an agent: every other project is a sub-agent counted under it', () => {
	const run = (id: number, item_id: string, node: string) => ({
		id,
		node,
		item_id,
		state: 'running',
		ended_at: null
	});
	const chief = { ...base, id: 'chief', agent: 'cos' };
	const flagged = { ...base, id: 'flagged', agent: 'flagged', needs_daniel: true, question };
	const live = { ...base, id: 'live', agent: 'flagged' };
	const touched = { ...base, id: 'touched', agent: 'touched' };
	const away = { ...base, id: 'away', agent: 'away' };
	const home = buildHomeSnapshot(
		{
			items: [chief, flagged, live, touched, away],
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
	expect(home.agents.map((agent) => agent.name)).toEqual(['Chief of Staff']);
	const [chiefOfStaff] = home.agents;
	expect(chiefOfStaff).toMatchObject({ id: 'cos', sessions: 0, state: 'working' });
	expect(chiefOfStaff.subAgents.sessions).toBe(2);
	expect(chiefOfStaff.subAgents.tasks.map((task) => task.itemId).sort()).toEqual([
		'flagged',
		'live'
	]);
	expect(JSON.stringify(home.agents)).not.toContain('touched');
	expect(soonestWork(home.overview).map((item) => item.id)).toContain('touched');
});

test('no sub-agent sessions and no Chief of Staff gives no agents, and an idle Chief stays idle', () => {
	const chief = { ...base, id: 'chief', agent: 'cos' };
	const other = { ...base, id: 'other', agent: 'other' };
	const none = buildHomeSnapshot({ items: [other], runs: [], machines: [] }, noProviders, now);
	expect(none.agents).toEqual([]);
	const idle = buildHomeSnapshot(
		{ items: [chief, other], runs: [], machines: [] },
		noProviders,
		now
	);
	expect(idle.agents).toMatchObject([{ name: 'Chief of Staff', state: 'idle' }]);
	expect(idle.agents[0].subAgents).toEqual({ sessions: 0, tasks: [] });
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
