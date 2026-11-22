import { expect } from '../../../test/verificationExpect';
import { test, vi } from 'vitest';
import type { OverviewSnapshot } from '../../reports/src/lib/projects-sessions/project-overview/projectOverview.types';
import { remoteFixture } from './remote-fixture';
import { localFixture } from './local-transport-fixture';

const reader = vi.hoisted(() => ({ read: vi.fn() }));
vi.mock('../../reports/src/lib/projects-sessions/project-overview/readProjectOverview', () => ({
	readProjectOverview: reader.read
}));

/** A synthetic tracker snapshot: one project, one in-progress item, no live session. */
const item = {
	id: 'fixture-item-1',
	title: 'Synthetic item',
	status: 'in_progress',
	updatedAt: '2026-11-20T09:00:00.000Z',
	due: null,
	live: false,
	stale: false
};
const snapshot: OverviewSnapshot = {
	status: 'ready',
	projects: [
		{
			agent: 'fixture-project',
			state: 'quiet',
			liveSessions: 0,
			counts: { open: 0, in_progress: 1, blocked: 0, done: 0 },
			items: [item as never],
			attention: null,
			blocked: null,
			milestone: null,
			updatedAt: '2026-11-20T09:00:00.000Z'
		}
	],
	machines: [{ name: 'fixture-computer', status: 'ok' }],
	liveSessions: 0
};

/** The refusal code of a request, or `accepted`. */
const outcome = (
	client: { request: (method: never, input?: Record<string, unknown>) => Promise<unknown> },
	method: string,
	input: Record<string, unknown> = {}
) =>
	client.request(method as never, input).then(
		() => 'accepted',
		(error: { code?: string }) => error.code ?? 'threw'
	);

test('the window reads the fixed local tracker with no argument and receives its snapshot', async () => {
	reader.read.mockReset();
	reader.read.mockResolvedValue(snapshot);
	const f = await localFixture(),
		client = f.connect(f.window());
	expect(await client.request('projectOverview')).toEqual(snapshot);
	expect(reader.read).toHaveBeenCalledTimes(1);
	expect(reader.read.mock.calls[0]).toEqual([]);
}, 30000);

test('an epoch is the only protocol field a read accepts, and nothing else reaches the tracker', async () => {
	reader.read.mockReset();
	reader.read.mockResolvedValue(snapshot);
	const f = await localFixture(),
		client = f.connect(f.window());
	expect(await outcome(client, 'projectOverview', { epoch: 'session-epoch' })).toBe('accepted');
	expect(reader.read.mock.calls[0]).toEqual([]);
	for (const input of [
		{ url: 'http://127.0.0.1:1/' },
		{ projectId: 'fixture-project' },
		{ path: '/etc/passwd' },
		{ fetch: true }
	]) {
		await expect(client.request('projectOverview', input)).rejects.toThrow();
	}
	expect(reader.read).toHaveBeenCalledTimes(1);
}, 30000);

test('a tracker that cannot be read answers unavailable, not a snapshot of nothing', async () => {
	reader.read.mockReset();
	reader.read.mockResolvedValue({ status: 'unavailable' });
	const f = await localFixture(),
		client = f.connect(f.window());
	expect(await client.request('projectOverview')).toEqual({ status: 'unavailable' });
}, 30000);

test('paired phones and devices are refused the overview', async () => {
	reader.read.mockReset();
	const f = await remoteFixture(),
		{ client } = await f.device().connect();
	expect(await outcome(client as never, 'projectOverview')).toBe('method-denied');
	expect(reader.read).not.toHaveBeenCalled();
}, 30000);
