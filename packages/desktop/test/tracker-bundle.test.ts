import { afterEach, expect, test } from 'vitest';
import { spawnSync } from 'node:child_process';
import {
	existsSync,
	lstatSync,
	mkdirSync,
	readFileSync,
	readlinkSync,
	rmSync,
	writeFileSync
} from 'node:fs';
import { join } from 'node:path';
import { installBundledTracker } from '../src/services/development-tooling/tracker-bundle/installBundledTracker';
import { startBundledTracker } from '../src/services/development-tooling/tracker-bundle/startBundledTracker';
import { trackerBundleLayout } from '../src/services/development-tooling/tracker-bundle/trackerBundleLayout';
import {
	existingAgent,
	fakeLaunchd,
	trackerFixture,
	writeTrackerConfig
} from './tracker-bundle-fixture';

const revision = 'a'.repeat(40);
const fixtures: string[] = [];
afterEach(() => {
	for (const root of fixtures.splice(0)) rmSync(root, { recursive: true, force: true });
});
function fixture(text?: string) {
	const made = trackerFixture(text);
	fixtures.push(made.root);
	const appPath = join(made.app, 'Contents/Resources/app');
	mkdirSync(appPath);
	writeFileSync(join(appPath, 'package.json'), JSON.stringify({ revision }));
	return { ...made, appPath, layout: trackerBundleLayout(made.home) };
}
function agentJson(agent: string): Record<string, unknown> {
	const result = spawnSync('/usr/bin/plutil', ['-convert', 'json', '-o', '-', agent], {
		encoding: 'utf8'
	});
	return JSON.parse(result.stdout);
}

function readInstallLog(directory: string) {
	return readFileSync(join(directory, 'tracker-install.log'), 'utf8')
		.trim()
		.split('\n')
		.map((line) => JSON.parse(line));
}

const darwin = test.runIf(process.platform === 'darwin');

darwin(
	'first install on a Mac with a Tracker configuration creates the service for its role',
	async () => {
		const { app, home, layout } = fixture();
		writeTrackerConfig(home, 'spoke');
		const launchd = fakeLaunchd();
		const outcome = await installBundledTracker({ app, revision, home, host: launchd.host });
		expect(outcome.status).toBe('installed');
		const program = agentJson(layout.agent).ProgramArguments as string[];
		expect(program.slice(1)).toEqual([
			'tracker',
			'serve',
			'--config',
			layout.config,
			'--role',
			'spoke'
		]);
		expect(program[0]).toBe(
			join(layout.releases, (outcome as { release: string }).release, 'harness')
		);
		expect(readlinkSync(layout.launcher)).toBe(program[0]);
		expect(readlinkSync(layout.entry)).toBe(program[0].replace(/harness$/, 'tracker-shim.sh'));
		expect(launchd.calls).toContain('bootstrap');
		expect(readFileSync(join(program[0], '..', 'BUILD_COMMIT'), 'utf8').trim()).toBe(revision);
	}
);

darwin(
	'an update repoints only the executable and keeps config, role, database and environment',
	async () => {
		const { appPath, home, layout } = fixture();
		const config = writeTrackerConfig(home, 'hub');
		const database = join(home, '.local/state/harness/tracker.sqlite');
		mkdirSync(join(database, '..'), { recursive: true });
		writeFileSync(database, 'journal');
		const old = join(layout.releases, 'oldrelease0', 'harness');
		const agent = existingAgent(home, old);
		const before = agentJson(agent);
		const launchd = fakeLaunchd();
		launchd.loaded = true;
		launchd.stopDelayMs = 5250;
		const outcome = await startBundledTracker(appPath, home, launchd.host);
		expect(outcome).toMatchObject({ status: 'installed', restarted: true });
		const after = agentJson(agent);
		const program = after.ProgramArguments as string[];
		expect(program.slice(1)).toEqual((before.ProgramArguments as string[]).slice(1));
		expect(program).toHaveLength((before.ProgramArguments as string[]).length);
		expect(program[0]).not.toBe(old);
		expect({ ...after, ProgramArguments: null }).toEqual({ ...before, ProgramArguments: null });
		expect(readFileSync(database, 'utf8')).toBe('journal');
		expect(readFileSync(config, 'utf8')).toContain('"role":"hub"');
		expect(launchd.calls.filter((call) => ['bootout', 'bootstrap'].includes(call))).toEqual(['bootout', 'bootstrap']);
		expect(readInstallLog(layout.logs).at(-1)).toMatchObject({ revision, ...outcome });
	}
);

darwin('running the same app again changes nothing and does not restart the service', async () => {
	const { app, home } = fixture();
	writeTrackerConfig(home, 'hub');
	const launchd = fakeLaunchd();
	await installBundledTracker({ app, revision, home, host: launchd.host });
	launchd.calls.length = 0;
	const again = await installBundledTracker({ app, revision, home, host: launchd.host });
	expect(again.status).toBe('current');
	expect(launchd.calls).toEqual(['print']);
});

darwin('a release that never becomes ready is replaced by the one that was running', async () => {
	const { appPath, home, layout } = fixture();
	writeTrackerConfig(home, 'hub');
	const old = join(layout.releases, 'oldrelease0', 'harness');
	const agent = existingAgent(home, old);
	mkdirSync(join(home, '.local/libexec/harness'), { recursive: true });
	const launchd = fakeLaunchd();
	launchd.loaded = true;
	launchd.stopDelayMs = 6500;
	launchd.ready = (executable) => executable === old;
	const outcome = await startBundledTracker(appPath, home, launchd.host);
	expect(outcome.status).toBe('rolled-back');
	expect(agentJson(agent).ProgramArguments).toHaveLength(7);
	expect((agentJson(agent).ProgramArguments as string[])[0]).toBe(old);
	expect(existsSync(layout.launcher)).toBe(false);
	expect(existsSync(layout.entry)).toBe(false);
	expect(launchd.loaded).toBe(true);
	expect(launchd.calls.filter((call) => call === 'bootstrap')).toHaveLength(2);
	expect(readInstallLog(layout.logs).at(-1)).toMatchObject({ revision, ...outcome });
	launchd.stopDelayMs = Infinity;
	launchd.calls.length = 0;
	await expect(startBundledTracker(appPath, home, launchd.host)).rejects.toThrow(/stop/i);
	expect(launchd.calls).not.toContain('bootstrap');
	expect(readInstallLog(layout.logs).at(-1)).toMatchObject({ revision, status: 'failed' });
});

darwin('without a Tracker configuration it installs the command line only', async () => {
	const { app, home, layout } = fixture();
	const launchd = fakeLaunchd();
	const outcome = await installBundledTracker({ app, revision, home, host: launchd.host });
	expect(outcome.status).toBe('cli-only');
	expect(existsSync(layout.agent)).toBe(false);
	expect(launchd.calls).toEqual([]);
	expect(lstatSync(layout.entry).isSymbolicLink()).toBe(true);
});

darwin('a development run, a foreign agent and a foreign command are left alone', async () => {
	const { app, home, layout, root } = fixture();
	const launchd = fakeLaunchd();
	expect(
		(
			await installBundledTracker({
				app: join(root, 'missing.app'),
				revision,
				home,
				host: launchd.host
			})
		).status
	).toBe('not-bundled');
	const agent = existingAgent(home, '/usr/bin/other');
	spawnSync('/usr/bin/plutil', ['-replace', 'ProgramArguments.1', '-string', 'daemon', agent]);
	expect((await installBundledTracker({ app, revision, home, host: launchd.host })).status).toBe(
		'refused'
	);
	rmSync(agent);
	mkdirSync(join(layout.entry, '..'), { recursive: true });
	writeFileSync(layout.entry, 'legacy client');
	expect((await installBundledTracker({ app, revision, home, host: launchd.host })).status).toBe(
		'refused'
	);
	expect(readFileSync(layout.entry, 'utf8')).toBe('legacy client');
	expect(launchd.calls).toEqual([]);
});

darwin(
	'a new build keeps the previous release for rollback and prunes only its own old ones',
	async () => {
		const first = fixture('#!/bin/sh\necho 0.1.0 one\n');
		writeTrackerConfig(first.home, 'hub');
		const launchd = fakeLaunchd();
		const ids: string[] = [];
		for (const build of ['two', 'three', 'four', 'five']) {
			writeFileSync(
				join(first.app, 'Contents/Helpers/harness'),
				`#!/bin/sh\necho 0.1.0 ${build}\n`
			);
			const outcome = await installBundledTracker({
				app: first.app,
				revision,
				home: first.home,
				host: launchd.host
			});
			ids.push((outcome as { release: string }).release);
		}
		const kept = ids.filter((id) => existsSync(join(first.layout.releases, id)));
		expect(kept).toEqual(ids.slice(-3));
		const record = JSON.parse(readFileSync(first.layout.record, 'utf8'));
		expect(record.current).toBe(ids[3]);
	}
);
