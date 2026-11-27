import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { expect, test } from 'vitest';
import { trackerNodeRuntime } from '../../../src/services/projects-sessions/tracker-node-service/trackerNodeRuntime';
import { TrackerNativeRuntimeService } from '../../../src/services/projects-sessions/TrackerNativeRuntimeService';
import {
	managedFixtureBindings,
	managedForegroundConfig,
	managedTrackerItemRequest
} from '../../support/trackerManagedProcessFixture';
import { launchTmux } from '../../../src/adapters/projects-sessions/tracker-tmux-adapter/trackerManagedWorkerProcess';
import { measureWorkload } from '../../support/measureWorkload';
import { withTempDir } from '../../support/temporary';
import { healthyHost, trackerResourceHost } from '../../support/trackerHostResourceFixture';
import type { TrackerResourceScenario } from '../../support/trackerHostResourceFixture.types';

const primary = 'daniel-primary-mbp';
const mb2 = 'harbor-mbp-2';
const unit = 'service.projects-sessions-tracker-native-runtime';

const shortages: [string, string, Partial<TrackerResourceScenario>, RegExp][] = [
	['Mac free memory', primary, { freePercent: 24 }, /free memory 24% \(need at least 25%\)/],
	['unknown Mac memory', mb2, { freePercent: null }, /free memory unknown/],
	['Mac load', primary, { load: [15, 1] }, /load 15\.00 \(need under 15\)/],
	['available RAM', primary, { availableMB: 2047 }, /only 2047 MB RAM available/],
	['fleet disk floor', primary, { freeGB: 29.9 }, /only 29\.9 GB disk free .*at least 30 GB/],
	['other host disk', 'fixture-linux', { freeGB: 4.9 }, /only 4\.9 GB disk free/],
	['free inodes', primary, { freeInodes: 49_999 }, /only 49999 inodes free/],
	['inode percent', primary, { inodeFreePercent: 0.9 }, /inodes free/],
	['unreadable volume', primary, { unreadableVolume: true }, /could not be checked/],
	['overload', 'fixture-linux', { load: [1, 15.1] }, /overloaded \(5-min load 15\.10/],
	['low RAM share', 'fixture-linux', { freePercent: 9 }, /overloaded \(RAM available 9%/],
	['busy shared box', 'grok-box', { load: [1, 10.1] }, /shared box is busy/],
	['box RAM share', 'grok-box', { freePercent: 14 }, /shared box is busy \(RAM available 14%/],
	['box inodes', 'grok-box', { freeInodes: 99_999 }, /only 99999 inodes free/]
];

test.each(shortages)(
	'holds even an explicit launch for %s and starts it after recovery',
	(_name, node, shortage, reason) =>
		measureWorkload(unit, 'host-resource-hold', () =>
			withTempDir('hnt-res-', async (root) => {
				const fixture = trackerResourceHost(root, node);
				try {
					Object.assign(fixture.host, shortage);
					fixture.queue('res0000001', 'Harbor');
					await fixture.tick();
					expect(fixture.running()).toEqual([]);
					expect(fixture.waiting()).toMatch(reason);
					Object.assign(fixture.host, healthyHost, { unreadableVolume: false });
					await fixture.tick();
					expect(fixture.running()).toEqual(['res0000001']);
				} finally {
					fixture.database.close();
				}
			})
		)
);

test('reads this computer when the managed launcher runs sessions on it', () =>
	measureWorkload(unit, 'managed-host-sampling', () =>
		withTempDir('hnt-real-', async (root) => {
			const { config } = managedFixtureBindings(root);
			const loaded = managedForegroundConfig(root, config, 'macos');
			const effects = loaded.hostEffects;
			if (effects?.mode !== 'active' || !effects.launch) throw new TypeError('No launch fixture');
			effects.launch.minAvailableMemMB = Number.MAX_SAFE_INTEGER;
			const database = new DatabaseSync(':memory:');
			try {
				const runtime = new TrackerNativeRuntimeService(database, trackerNodeRuntime(loaded));
				runtime.store.appendLocal({
					itemId: 'real000001',
					fields: { title: 'Synthetic work', status: 'open', kind: 'task', project: 'Harness' }
				});
				expect((await managedTrackerItemRequest(runtime, 'real000001', 'launch')).ok).toBe(true);
				await runtime.scheduler!.tick(new AbortController().signal);
				expect(database.prepare('SELECT state FROM runs').all()).toEqual([]);
				expect(runtime.scheduler!.runnerStatus().waiting_on).toMatch(
					/^Tracker host resource hold: /
				);
			} finally {
				database.close();
			}
		})
	));

test('applies configured RAM and disk minimums', () =>
	measureWorkload(unit, 'host-resource-limits', () =>
		withTempDir('hnt-res-', async (root) => {
			const limits = { minAvailableMemMB: 64_000, minFreeDiskGB: 600 };
			const fixture = trackerResourceHost(root, primary, limits);
			try {
				fixture.queue('res0000001', 'Harbor');
				await fixture.tick();
				expect(fixture.waiting()).toMatch(/only 32000 MB RAM available/);
				fixture.host.availableMB = 65_000;
				await fixture.tick();
				expect(fixture.waiting()).toBeDefined();
				expect(fixture.running()).toEqual([]);
				fixture.host.freeGB = 601;
				fixture.queue('res0000002', 'Harbor');
				await fixture.tick();
				expect(fixture.running()).toHaveLength(1);
			} finally {
				fixture.database.close();
			}
		})
	));

test('keeps MB2 work outside Harbor to one budgeted session under load four', () =>
	measureWorkload(unit, 'mb2-cpu-budget', () => withTempDir('hnt-mb2-', proveMb2Budget)));

async function proveMb2Budget(root: string) {
	const fixture = trackerResourceHost(root, mb2);
	try {
		fixture.host.load = [4, 1];
		fixture.queue('other00001', 'Harness');
		await fixture.tick();
		expect(fixture.running()).toEqual([]);
		expect(fixture.waiting()).toMatch(/load 4\.00 \(need under 4 for non-Harbor\)/);
		fixture.host.load = [3.9, 1];
		await fixture.tick();
		expect(fixture.running()).toEqual(['other00001']);
		expect(fixture.started()).toMatchObject({ cpuBudget: 4 });
		expect(fixture.started().brief).toContain('**CPU budget:**');
		expect(fixture.started().brief).toContain('--maxWorkers=4');
		fixture.queue('other00002', 'Harness');
		await fixture.tick();
		expect(fixture.running()).toEqual(['other00001']);
		expect(fixture.waiting()).toMatch(/1\/1 non-Harbor sessions running/);
		fixture.host.load = [6, 23];
		fixture.queue('harbor0001', 'Harbor');
		await fixture.tick();
		expect(fixture.running()).toEqual(['other00001']);
		expect(fixture.waiting()).toMatch(/5-min load 23\.00/);
		fixture.host.load = [6, 1];
		await fixture.tick();
		expect(fixture.running()).toEqual(['other00001', 'harbor0001']);
		expect(fixture.started()).not.toHaveProperty('cpuBudget');
		expect(fixture.started().brief).not.toContain('CPU budget');
	} finally {
		fixture.database.close();
	}
}

test('considers Harbor first on MB2 only', () =>
	measureWorkload(unit, 'mb2-harbor-first', async () => {
		for (const [node, expected] of [
			[mb2, 'zharbor001'],
			[primary, 'aother0001']
		])
			await withTempDir('hnt-first-', async (root) => {
				const fixture = trackerResourceHost(root, node);
				try {
					fixture.queue('aother0001', 'Harness');
					fixture.queue('zharbor001', 'Harbor');
					await fixture.tick();
					expect(fixture.running()).toEqual([expected]);
				} finally {
					fixture.database.close();
				}
			});
	}));

test('starts a budgeted worker under nice with parallelism limits', () =>
	measureWorkload('adapter.projects-sessions-tracker-tmux', 'budgeted-worker', () =>
		withTempDir('hnt-prio-', async (root) => {
			const plain = await launchedArguments(root, undefined);
			const budgeted = await launchedArguments(root, 4);
			for (const name of ['TRACKER_CPU_BUDGET', 'CMAKE_BUILD_PARALLEL_LEVEL', 'GOMAXPROCS'])
				expect(budgeted).toContain(`${name}=4`);
			for (const name of ['CARGO_BUILD_JOBS', 'OMP_NUM_THREADS', 'RAYON_NUM_THREADS'])
				expect(budgeted).toContain(`${name}=4`);
			expect(budgeted).toContain('MAKEFLAGS=-j4');
			expect(budgeted.slice(-4)).toEqual(['/usr/bin/nice', '-n', '10', '/fixture/worker']);
			expect(plain.join(' ')).not.toMatch(/TRACKER_CPU_BUDGET|nice/);
		})
	));

async function launchedArguments(root: string, cpuBudget?: number): Promise<string[]> {
	const log = join(root, `tmux-${cpuBudget ?? 'plain'}.json`);
	const tmux = join(root, `tmux-${cpuBudget ?? 'plain'}`);
	writeFileSync(
		tmux,
		`#!${process.execPath}\nrequire('node:fs').writeFileSync(${JSON.stringify(log)}, JSON.stringify(process.argv.slice(2)));`,
		{ mode: 0o700 }
	);
	await launchTmux(
		{ tmux, trackerBin: root, trackerExecutable: tmux, worktree: root },
		{
			node: mb2,
			key: 'key',
			itemId: 'other00001',
			runId: 1,
			token: 'token',
			tmux: 'auto-other00001-r1',
			issuedAt: 0
		},
		{
			script: join(root, 'launch.sh'),
			command: { home: root, argv: ['/fixture/worker'] },
			clientPath: join(root, 'client.json'),
			cpuBudget
		},
		new AbortController().signal
	);
	return JSON.parse(readFileSync(log, 'utf8'));
}
