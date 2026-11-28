import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { expect, test } from 'vitest';
import {
	ensureTrackerRunSchema,
	trackerRunSchema
} from '../../../src/repositories/projects-sessions/tracker-dispatch-repository/trackerRunSchema';
import { TrackerRunReadRepository } from '../../../src/repositories/projects-sessions/TrackerRunReadRepository';
import { TrackerItemReadRepository } from '../../../src/repositories/projects-sessions/TrackerItemReadRepository';
import { recoveryRung } from '../../../src/services/projects-sessions/tracker-native-runtime-service/trackerRecoveryHistory';
import { quotaHost, quotaNode } from '../../support/trackerQuotaPauseFixture';
import { withTempDir } from '../../support/temporary';

const start = Date.parse('2026-11-28T20:00:00Z');
const prefer = { provider: 'claude', until: '2026-11-29T21:00:00.000Z' };
type Host = ReturnType<typeof quotaHost> & { endSessions(): void };

function withHost(run: (host: Host) => Promise<void>) {
	return withTempDir('hnt-task-type-', async (root) => {
		// The synthetic driver lists every session it started until the test ends them.
		const endSessions = () => writeFileSync(join(root, 'sessions'), '[]');
		const host = { ...quotaHost(root), endSessions };
		host.clock.now = start;
		try {
			await run(host);
		} finally {
			host.database.close();
		}
	});
}

const latestRun = (host: Host, itemId: string) =>
	host.database
		.prepare(
			`SELECT id, rung, cli, model, effort, task_type, state, reason FROM runs
			WHERE item_id = ? ORDER BY id DESC LIMIT 1`
		)
		.get(itemId) as Record<string, string> & { id: number };

async function create(host: Host, title: string, fields: object = {}) {
	const { status, body } = await host.api('POST', '/items', {
		title,
		project: 'Harness',
		force: true,
		...fields
	});
	expect(status, JSON.stringify(body)).toBeLessThan(300);
	return (body.item ?? body).id as string;
}

async function launch(host: Host, id: string, options: object = {}) {
	const body = { computer: quotaNode, ...options };
	const response = await host.api('POST', `/items/${id}/launch`, body);
	expect(response.status, JSON.stringify(response.body)).toBeLessThan(300);
	await host.tick();
}

async function fail(host: Host, itemId: string) {
	const { id } = latestRun(host, itemId);
	const meta = host.runtime.store.getMeta(`harness_dispatch_run:${id}`)!;
	const { revision } = JSON.parse(meta) as { revision: number };
	host.clock.now += 60_000;
	await host.runtime.dispatch!.record(
		itemId,
		{ id, revision },
		{ type: 'monitor', session: 'exited', exitCode: 1 }
	);
	host.endSessions();
}

test('add and update --kind set the task type that show and list report', () =>
	withHost(async (host) => {
		const id = await create(host, 'Add the synthetic export view', { kind: 'coordinator' });
		const read = async () => (await host.api('GET', `/items/${id}`)).body;
		expect(await read()).toMatchObject({
			kind: 'task',
			task_type: 'coordinator',
			task_type_inferred: false
		});
		const listed = await host.api('GET', '/items?kind=coordinator');
		expect(listed.body.map((item: { id: string }) => item.id)).toEqual([id]);
		await host.api('PATCH', `/items/${id}`, { kind: 'auto' });
		expect(await read()).toMatchObject({ task_type: 'default', task_type_inferred: true });
		expect((await host.api('GET', '/items?kind=coordinator')).body).toEqual([]);
		expect((await host.api('PATCH', `/items/${id}`, { task_type: 'poetry' })).status).toBe(400);
	}));

test('tracker launch --model starts exactly that model under the Claude preference', () =>
	withHost(async (host) => {
		await host.api('POST', '/autolaunch/prefer', prefer);
		for (const [model, effort] of [
			['gpt-6.1-terra', 'medium'],
			['gpt-6.2-sol', 'high']
		]) {
			const id = await create(host, `Add the synthetic ${model} export view`);
			await launch(host, id, { model: `${model}:${effort}` });
			expect(latestRun(host, id)).toMatchObject({ cli: 'codex', model, effort });
			expect(latestRun(host, id).reason).toContain('explicit --model wins');
		}
	}));

test('each launch records its task type and chosen rung', () =>
	withHost(async (host) => {
		await host.api('POST', '/autolaunch/prefer', prefer);
		for (const [title, type, rung, effort] of [
			['Coordinate the synthetic push', 'coordinator', 'opus', 'high'],
			['Design mockups for the synthetic view', 'design', 'fable', 'high'],
			['Add the synthetic export view', 'default', 'sonnet', 'medium']
		]) {
			const id = await create(host, title);
			await launch(host, id);
			expect(latestRun(host, id), title).toMatchObject({ task_type: type, rung, effort });
		}
		const history = new TrackerRunReadRepository(host.database, quotaNode);
		expect(history.exportLocal().map((run) => run.task_type)).toContain('coordinator');
	}));

test('after Opus fails twice the next launch goes to Fable', () =>
	withHost(async (host) => {
		await host.api('POST', '/autolaunch/prefer', prefer);
		const id = await create(host, 'Coordinate the synthetic push');
		await launch(host, id);
		await fail(host, id);
		await host.tick();
		expect(latestRun(host, id)).toMatchObject({ rung: 'opus', state: 'running' });
		await fail(host, id);
		// Chief of Staff answers the give-up question, then launches again.
		await host.api('POST', `/items/${id}/resolve`, {});
		await host.api('POST', `/items/${id}/unblock`, {});
		host.clock.now += 60_000;
		await launch(host, id);
		expect(latestRun(host, id)).toMatchObject({ model: 'claude-fable-5-2', effort: 'high' });
		expect(latestRun(host, id).reason).toContain('hard escalation');
	}));

test('a model-quality incident note on Opus sends the next launch to Fable', () =>
	withHost(async (host) => {
		const id = await create(host, 'Coordinate the synthetic push');
		await host.api('POST', `/items/${id}/note`, {
			text: 'model-quality incident: claude-opus-5-5 skipped a required check'
		});
		expect((await host.api('GET', `/items/${id}/pick`)).body).toMatchObject({
			model: 'claude-fable-5-2',
			task_type: 'coordinator'
		});
		await launch(host, id);
		expect(latestRun(host, id).model).toBe('claude-fable-5-2');
	}));

test('a lost session relaunches one rung up, and a context handoff keeps its model', () =>
	withHost(async (host) => {
		await host.api('POST', '/autolaunch/prefer', prefer);
		const id = await create(host, 'Add the synthetic export view');
		await launch(host, id);
		const runs = new TrackerRunReadRepository(host.database, quotaNode);
		const items = new TrackerItemReadRepository(host.database, () => host.clock.now);
		const lost = {
			...runs.list({ itemId: id })[0],
			state: 'finished' as const,
			outcome: 'abandoned' as const,
			failure_reason: 'Managed tmux session disappeared',
			ended_at: start + 600_000
		};
		const item = items.getStored(id);
		expect(recoveryRung(lost, item, quotaNode)).toMatchObject({
			model: 'claude-sonnet-5-5',
			effort: 'medium',
			climbFrom: { effort: 'medium' }
		});
		const note = {
			node: quotaNode,
			at: new Date(start + 300_000).toISOString(),
			text: 'stopped: watchdog context handoff; resume from: synthetic worktree and next step'
		};
		const handedOff = { ...item, notes_log: [...item.notes_log, note] };
		expect(recoveryRung(lost, handedOff, quotaNode)).not.toHaveProperty('climbFrom');

		await fail(host, id);
		const rung = recoveryRung(lost, items.getStored(id), quotaNode)!;
		await host.api('POST', `/items/${id}/unlaunch`, {});
		host.runtime.store.appendLocal({ itemId: id, fields: { status: 'in_progress', auto: null } });
		await host.runtime.dispatch!.request(id, {
			source: 'recovery',
			token: 'relaunch-token',
			expectedAuto: null,
			rung
		});
		expect(latestRun(host, id)).toMatchObject({
			model: 'claude-sonnet-5-5',
			effort: 'high',
			task_type: 'default'
		});
	}));

test('older run tables gain the task type and an older peer cannot erase it', () => {
	const database = new DatabaseSync(':memory:');
	try {
		database.exec(trackerRunSchema.replaceAll(/,? task_type TEXT/g, ''));
		ensureTrackerRunSchema(database);
		ensureTrackerRunSchema(database);
		const runs = new TrackerRunReadRepository(database, 'alpha');
		const row = { id: 1, item_id: 'synthetic', state: 'finished', rung: 'sonnet', cli: 'claude' };
		const full = { ...row, attempt: 1, model: 'claude-sonnet-5-5', queued_at: 1, pinned: 0 };
		runs.importRemote('beta', [{ ...full, task_type: 'simple' }]);
		runs.importRemote('beta', [full]);
		expect(runs.list({ itemId: 'synthetic' })[0]).toMatchObject({ task_type: 'simple' });
	} finally {
		database.close();
	}
});
