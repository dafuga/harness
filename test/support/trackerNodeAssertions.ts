import { proveDuplicateIntake } from './trackerDuplicateIntakeFixture';
import { qualifyPlanningStages } from './trackerPlanningAssertions';
import { verifyLaunchCliOptions } from './trackerManagedLaunchAssertions';
import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { once } from 'node:events';
import { expect } from 'vitest';
import {
	fixtureTrackerJson,
	loopback,
	startTrackerFixture,
	trackerProcess,
	verifyDefaultPickup,
	verifyTrackerWire
} from './trackerNodeProcess';
import type { TrackerFixtureReceipts, TrackerNodeFixture } from './trackerNodeProcess.types';
import { verifyCosDryRun } from './verifyCosDryRun';
import { verifyIgnoreExpiry, verifyProjectFollowUp, verifyReminder } from './trackerNodeReminder';
export async function proveForegroundSync(
	hub: TrackerNodeFixture,
	spoke: TrackerNodeFixture,
	syncPort: number,
	sink: Awaited<ReturnType<typeof notificationSink>>
) {
	const hubOwner = await startTrackerFixture(hub);
	try {
		const spokeOwner = await startTrackerFixture(spoke);
		try {
			expect(hubOwner.ready).toMatchObject({
				node: 'synthetic-hub',
				syncPort,
				checkpoint: 'fixture-migration-01'
			});
			expect(await fixtureTrackerJson(hub, ['ensure'])).toMatchObject({
				version: 'harness-native',
				role: 'hub'
			});
			const { id } = await fixtureTrackerJson(spoke, [
				'add',
				'Synthetic loopback qualification',
				'--callback-url',
				sink.base + '/callback'
			]);
			await qualifyItemCommands(spoke, id);
			await qualifyPlanningStages(spoke, id);
			const sync = await trackerProcess(spoke, ['sync']).exited;
			expect(sync).toMatchObject({ code: 0, stdout: 'sync triggered\n' });
			await expect
				.poll(() => fixtureTrackerJson(hub, ['list']), { timeout: 8_000 })
				.toEqual(expect.arrayContaining([expect.objectContaining({ id })]));
			expect(await fixtureTrackerJson(hub, ['show', id])).toMatchObject({ stage: 'build' });
			await verifySpokePublication(hub);
			await verifyDefaultPickup(hub);
			await verifyTrackerWire(syncPort, id);
			const reverse = await fixtureTrackerJson(hub, ['add', 'Reverse fixture item']);
			await verifyIgnoreExpiry(spoke, reverse.id);
			await verifyTrackerNotificationFlow(hub, spoke, id, sink.receipts);
			await verifyProjectFollowUp(hub, spoke);
			expect(await fixtureTrackerJson(spoke, ['status'])).toMatchObject({
				role: 'spoke',
				sync: { connected: true, pending_push: 0 },
				native: { provider_runner: 'disabled', notification_tick: true }
			});
		} finally {
			expect((await spokeOwner.stop()).code).toBe(0);
		}
	} finally {
		expect((await hubOwner.stop()).code).toBe(0);
	}
	expect((await trackerProcess(spoke, ['ensure']).exited).code).toBe(3);
}
async function verifySpokePublication(hub: TrackerNodeFixture) {
	await expect
		.poll(() => fixtureTrackerJson(hub, ['runs', '--item', 'spokerun22']), { timeout: 8_000 })
		.toMatchObject([
			{ id: 22, node: 'synthetic-spoke', state: 'running', auto_token: 'spoke-token' }
		]);
	await expect
		.poll(() => fixtureTrackerJson(hub, ['autolaunch', 'status']), { timeout: 8_000 })
		.toMatchObject({
			computers: expect.arrayContaining([
				expect.objectContaining({ computer: 'synthetic-spoke', state: 'disabled', active_runs: 1 })
			])
		});
}

async function qualifyItemCommands(spoke: TrackerNodeFixture, id: string) {
	const short = id.slice(0, 6);
	await proveDuplicateIntake(spoke, id, short);
	expect(
		await fixtureTrackerJson(spoke, [
			'chase',
			short,
			'--note',
			'Daniel asked for status',
			'--by',
			'Chief of Staff'
		])
	).toMatchObject({
		id,
		chased_count: 1,
		chased_by: 'Chief of Staff',
		chased_reason: 'Daniel asked for status'
	});

	await verifyLaunchCliOptions(spoke, id);
}
async function verifyTrackerNotificationFlow(
	hub: TrackerNodeFixture,
	spoke: TrackerNodeFixture,
	id: string,
	receipts: Awaited<ReturnType<typeof notificationSink>>['receipts']
) {
	const choices = ['--option', 'Ready=Continues.', '--option', 'Wait=Holds.', '--recommend', 'A'];
	const processQuestion = 'Which command should I use to close this already approved cleanup?';
	const refused = await trackerProcess(spoke, ['flag', id, processQuestion, ...choices]).exited;
	expect(refused.code, processQuestion).toBe(1);
	expect(refused.stderr).toContain('kept for Chief of Staff');
	expect(await fixtureTrackerJson(spoke, ['list', '--flagged'])).toEqual([]);
	const alerts = await fixtureTrackerJson(spoke, ['needs-attention']);
	expect(alerts).toContainEqual(expect.objectContaining({ item_id: id, kind: 'flag-refused' }));
	expect(
		await fixtureTrackerJson(spoke, ['flag', id, 'Is the fixture ready?', ...choices])
	).toMatchObject({ needs_daniel: true });
	await expect
		.poll(async () => (await trackerProcess(hub, ['digest']).exited).stdout)
		.toContain('Is the fixture ready?');
	verifyCosDryRun(hub, id);
	expect(await fixtureTrackerJson(hub, ['digest'])).toMatchObject({
		needs_daniel: [{ id, question: 'Is the fixture ready?', waiting_minutes: expect.any(Number) }]
	});
	await verifyReminder(hub, spoke, id, receipts);
	expect(
		await fixtureTrackerJson(spoke, ['answer', id, 'Fixture confirmed', '--by', 'fixture-operator'])
	).toMatchObject({
		id,
		resolved: true,
		needs_daniel: false,
		answer: 'Fixture confirmed',
		answered_by: 'fixture-operator'
	});
	expect(
		await fixtureTrackerJson(spoke, ['done', id, '--note', 'Completion before worktree cleanup'])
	).toMatchObject({ id, status: 'done' });
	await verifyCompletionCallback(receipts, id);
	await expect
		.poll(() => fixtureTrackerJson(hub, ['list', '--chased']))
		.toMatchObject([{ id, status: 'done', chased_count: 1 }]);
	await expect
		.poll(() => fixtureTrackerJson(hub, ['show', id]), { timeout: 8_000 })
		.toMatchObject({
			id,
			status: 'done',
			chased_count: 1,
			chased_reason: 'Daniel asked for status',
			answer: 'Fixture confirmed',
			notes_log: expect.arrayContaining([
				expect.objectContaining({ text: 'Completion before worktree cleanup' })
			])
		});
}

async function verifyCompletionCallback(
	receipts: Awaited<ReturnType<typeof notificationSink>>['receipts'],
	id: string
) {
	await expect
		.poll(
			() =>
				[...receipts.values()].filter(({ path }) => path === '/callback').map(({ body }) => body),
			{ timeout: 9_000 }
		)
		.toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					type: 'item',
					events: expect.arrayContaining(['done']),
					item: expect.objectContaining({ id, status: 'done' })
				})
			])
		);
}
export async function notificationSink(port: number) {
	const receipts: TrackerFixtureReceipts = new Map();
	const server = createServer((request, response) => {
		void collectReceipt(request, response, receipts).catch(() => response.writeHead(500).end());
	});
	server.listen(port, '127.0.0.1');
	await once(server, 'listening');
	return {
		base: loopback(port),
		receipts,
		close: () => new Promise<void>((resolve) => server.close(() => resolve()))
	};
}

async function collectReceipt(
	request: IncomingMessage,
	response: ServerResponse,
	receipts: TrackerFixtureReceipts
) {
	const key = request.headers['idempotency-key'];
	const path = request.url ?? '';
	const chunks: Buffer[] = [];
	for await (const chunk of request) chunks.push(chunk);
	if (typeof key !== 'string') {
		response.writeHead(400).end();
		return;
	}
	if (!receipts.has(key))
		receipts.set(key, { path, body: JSON.parse(Buffer.concat(chunks).toString()) });
	response.writeHead(204).end();
}
