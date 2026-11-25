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
	agent: 'Synthetic agent',
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
	expect(home.agents).toMatchObject([{ itemId: base.id, question }]);
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

test('working means a live run now: flagged projects with runs count, touched-today projects without runs do not', () => {
	const run = (id: number, item_id: string, node: string) => ({
		id,
		node,
		item_id,
		state: 'running',
		ended_at: null
	});
	const flagged = { ...base, id: 'flagged', agent: 'flagged', needs_daniel: true, question };
	const live = { ...base, id: 'live', agent: 'flagged' };
	const touched = { ...base, id: 'touched', agent: 'touched' };
	const away = { ...base, id: 'away', agent: 'away' };
	const home = buildHomeSnapshot(
		{
			items: [flagged, live, touched, away],
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
	const byName = Object.fromEntries(home.agents.map((agent) => [agent.name, agent]));
	expect(byName.flagged).toMatchObject({ state: 'needs-you', sessions: 2 });
	expect(byName.flagged.tasks.map((task) => [task.itemId, task.machine])).toEqual(
		expect.arrayContaining([['live', 'primary']])
	);
	expect(byName.touched).toMatchObject({ state: 'idle', sessions: 0, tasks: [] });
	expect(byName.away).toMatchObject({ state: 'offline', sessions: 0 });
	expect(home.agents.filter((agent) => agent.sessions > 0)).toHaveLength(1);
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
