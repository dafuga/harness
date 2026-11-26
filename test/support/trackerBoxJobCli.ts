import { realpathSync } from 'node:fs';
import { expect } from 'vitest';
import { withTempDir } from './temporary';
import {
	finishedTrackerProcess,
	fixtureConfig,
	fixtureTrackerJson,
	freeTrackerPorts,
	loopback,
	startTrackerFixture,
	trackerFixtureFiles,
	writeTrackerFixture
} from './trackerNodeProcess';
import type { TrackerNodeFixture } from './trackerNodeProcess.types';

/** A foreground hub and spoke, driven through the installed CLI shim. */
export async function proveTrackerJobCommands() {
	await withTempDir('hnt-', async (temporary) => {
		const root = realpathSync(temporary);
		trackerFixtureFiles(root);
		const [apiPort, syncPort, spokeApi, sink] = await freeTrackerPorts(4);
		const hub = writeTrackerFixture(root, {
			...fixtureConfig(root, 'jobs-hub', apiPort),
			role: 'hub',
			syncPort,
			notifications: { targets: { cos: { url: loopback(sink) } }, webhook: 'cos' }
		});
		const spoke = writeTrackerFixture(root, {
			...fixtureConfig(root, 'jobs-spoke', spokeApi),
			role: 'spoke',
			upstream: { url: loopback(syncPort) }
		});
		const owners = [await startTrackerFixture(hub), await startTrackerFixture(spoke)];
		try {
			await proveJobCommands(hub, spoke);
		} finally {
			for (const owner of owners) await owner.stop();
		}
	});
}

async function proveJobCommands(hub: TrackerNodeFixture, spoke: TrackerNodeFixture) {
	const run = (args: string[]) => finishedTrackerProcess(hub, args);
	expect(await fixtureTrackerJson(hub, ['status'])).toMatchObject({
		jobs: { enabled: true, jobs: 0 },
		native: { job_runner: 'configured' }
	});
	const { id } = await fixtureTrackerJson(hub, ['add', 'Nightly disk check', '--every', '@daily']);
	const short = id.slice(0, 6);
	const set = ['job', 'set', short, '--cmd', 'echo "2 issues"; exit 10', '--wake-on', 'fail'];
	expect(await run([...set, '--timeout', '30'])).toMatchObject({
		code: 0,
		stdout: `box job set on [${short}]: wake on fail, timeout 30s\n`
	});
	expect((await run(['job', 'list'])).stdout).toBe(
		`[${short}] Nightly disk check  (every @daily | wake on fail | timeout 30s)\n    echo "2 issues"; exit 10\n`
	);
	expect(await run(['job', 'test', short])).toMatchObject({
		code: 0,
		stdout: 'exit 10 (finding: would wake the owner)\n2 issues\n'
	});
	expect(await run(['job', 'rm', short])).toMatchObject({
		code: 0,
		stdout: `box job removed from [${short}]\n`
	});
	expect((await run(['job', 'list'])).stdout).toBe('(no box jobs)\n');
	expect(await run(['job', 'set', short, '--timeout', 'soon'])).toMatchObject({ code: 1 });
	const refused = await finishedTrackerProcess(spoke, ['job', 'list']);
	expect(refused.code).toBe(1);
	expect(refused.stderr).toContain('box jobs run only on the hub');
}
