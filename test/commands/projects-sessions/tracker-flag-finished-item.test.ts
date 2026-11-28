import { realpathSync } from 'node:fs';
import { expect, test } from 'vitest';
import { withTempDir } from '../../support/temporary';
import { trackerNeedsYouViews } from '../../support/trackerFinishedFlagViews';
import { notificationSink } from '../../support/trackerNodeAssertions';
import * as node from '../../support/trackerNodeProcess';
import type { TrackerNodeFixture } from '../../support/trackerNodeProcess.types';

const question = 'Sample service is down again. Restart it?';
const flag = ['--option', 'Restart=A session restarts it.', '--option', 'Wait=Keep watching.'];

/** A monitor's item was closed, then the monitor asked on it. The ask must be shown, not dropped. */
test('a structured flag on a done item is shown in every needs-you view until answered', async () => {
	await withTempDir('hnt-', async (temporary) => {
		const root = realpathSync(temporary);
		node.trackerFixtureFiles(root);
		const [api, sync, port] = await node.freeTrackerPorts(3);
		const sink = await notificationSink(port);
		const hub = node.writeTrackerFixture(root, {
			...node.fixtureConfig(root, 'synthetic-hub', api),
			role: 'hub',
			syncPort: sync,
			// The live hub's shape: one batched Chief of Staff webhook.
			notifications: { targets: { cos: { url: sink.base + '/cos' } }, webhook: 'cos' }
		});
		const owner = await node.startTrackerFixture(hub);
		try {
			await proveShownUntilAnswered(hub, () => JSON.stringify([...sink.receipts.values()]));
		} finally {
			expect((await owner.stop()).code).toBe(0);
			await sink.close();
		}
	});
}, 60_000);

async function proveShownUntilAnswered(hub: TrackerNodeFixture, delivered: () => string) {
	const { id } = await node.fixtureTrackerJson(hub, [
		'add',
		'Sample service watch',
		'--agent',
		'sample',
		'--later'
	]);
	await node.fixtureTrackerJson(hub, ['done', id, '--note', 'Recovered']);
	expectEveryView(await trackerNeedsYouViews(hub, id), false);
	expect(delivered()).not.toContain(question);

	const asked = await node.finishedTrackerProcess(hub, [
		...['flag', id, question, ...flag],
		...['--recommend', '1']
	]);
	expect(asked).toMatchObject({ code: 0, stderr: '' });
	expect(asked.stdout).toContain('awaiting Chief of Staff review');
	expectEveryView(await trackerNeedsYouViews(hub, id), false);
	expect(delivered()).not.toContain(question);

	const released = await node.finishedTrackerProcess(hub, [
		'release',
		id,
		question,
		...flag,
		'--recommend',
		'1',
		'--by',
		'Chief of Staff'
	]);
	expect(released).toMatchObject({ code: 0, stderr: '' });
	expect(released.stdout).toContain('DONE, NEEDS DANIEL');
	expectEveryView(await trackerNeedsYouViews(hub, id), true);
	expect((await node.finishedTrackerProcess(hub, ['digest'])).stdout).toContain(
		'ITEM DONE, FLAG STILL OPEN'
	);
	// Chief of Staff is pushed the ask itself, without waiting for anyone to open a view.
	await expect.poll(delivered, { timeout: 20_000 }).toContain(question);
	expect(delivered()).toContain('NEEDS DANIEL');

	expect(
		await node.fixtureTrackerJson(hub, ['answer', id, '--option', '1', '--by', 'Daniel'])
	).toMatchObject({ status: 'done', needs_daniel: false, answer: 'Restart' });
	expectEveryView(await trackerNeedsYouViews(hub, id), false);
}

function expectEveryView(views: Awaited<ReturnType<typeof trackerNeedsYouViews>>, shown: boolean) {
	expect(views).toEqual(Object.fromEntries(Object.keys(views).map((view) => [view, shown])));
}
