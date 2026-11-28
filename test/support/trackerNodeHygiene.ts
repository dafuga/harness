import { realpathSync } from 'node:fs';
import { expect } from 'vitest';
import { measureWorkload } from './measureWorkload';
import { withTempDir } from './temporary';
import {
	fixtureConfig,
	fixtureTrackerJson,
	freeTrackerPorts,
	startTrackerFixture,
	trackerFixtureFiles,
	trackerProcess,
	writeTrackerFixture
} from './trackerNodeProcess';
import type { TrackerNodeFixture } from './trackerNodeProcess.types';

export function proveTrackerHygieneCloseout() {
	return withTempDir('hnt-hygiene-', async (temporary) => {
		const root = realpathSync(temporary);
		trackerFixtureFiles(root);
		const [apiPort, syncPort] = await freeTrackerPorts(2);
		const hub = writeTrackerFixture(root, {
			...fixtureConfig(root, 'hygiene-hub', apiPort),
			role: 'hub',
			syncPort
		});
		const owner = await startTrackerFixture(hub);
		try {
			await measureWorkload('command.projects-sessions-tracker', 'launched-hygiene-cli', () =>
				verifyHygieneCloseout(hub)
			);
		} finally {
			expect((await owner.stop()).code).toBe(0);
		}
	});
}

async function verifyHygieneCloseout(hub: TrackerNodeFixture) {
	const { id } = await fixtureTrackerJson(hub, ['add', 'Close the synthetic launch item']);
	const item = id.slice(0, 6);
	const worker = { ...hub, env: { TRACKER_ITEM_ID: id, TRACKER_RUN_ID: '42' } };
	for (const args of [
		['block', item, 'Waiting on CI', '--force'],
		['done', item, '--force']
	]) {
		const refused = await trackerProcess(worker, args).exited;
		expect(refused).toMatchObject({
			code: 1,
			stdout: '',
			stderr: expect.stringContaining('hygiene: closed')
		});
	}
	expect(await fixtureTrackerJson(hub, ['show', id])).toMatchObject({ status: 'open' });
	const blocker = 'Waiting on CI\nhygiene: closed 0 tabs/windows; left open: none';
	expect(await fixtureTrackerJson(worker, ['block', item, blocker])).toMatchObject({
		status: 'blocked',
		blocked_reason: blocker
	});
	await fixtureTrackerJson(hub, ['unblock', id]);
	const proof = 'hygiene: closed 2 tabs/windows I opened; left open: shared preview for review';
	expect(await fixtureTrackerJson(worker, ['done', item, '--note', proof])).toMatchObject({
		status: 'done',
		notes_log: expect.arrayContaining([expect.objectContaining({ text: proof })])
	});
}
