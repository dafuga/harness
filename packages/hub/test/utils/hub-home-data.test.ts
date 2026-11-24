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

test('posted Tracker notes are not shown as agent replies; Hub messages are shown as Daniel', () => {
	const work = {
		...base,
		notes_log: [
			{ text: 'Tests pass on MB2', at: '2026-11-21T22:10:00Z' },
			{ text: 'Hub message: please keep going', at: '2026-11-21T22:11:00Z' }
		]
	};
	const { agents } = buildHomeSnapshot({ items: [work], runs: [], machines: [] }, noProviders, now);
	expect(agents[0]?.messages.map(({ text, from }) => ({ text, from }))).toEqual([
		{ text: 'Tests pass on MB2', from: 'tracker' },
		{ text: 'please keep going', from: 'you' }
	]);
});
