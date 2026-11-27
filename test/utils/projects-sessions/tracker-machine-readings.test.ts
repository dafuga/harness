import { expect, test } from 'vitest';
import {
	parseTrackerMeminfo,
	parseTrackerMemoryPressure,
	parseTrackerPressureFree,
	parseTrackerSwapUsage,
	parseTrackerVmStat
} from '../../../src/adapters/projects-sessions/tracker-machine-sampler-adapter/trackerMemoryParsers';
import {
	groupTrackerProcesses,
	groupTrackerSystemProcesses,
	parseTrackerProcesses
} from '../../../src/utils/projects-sessions/groupTrackerProcesses';
import { TrackerMachineSamplerAdapter } from '../../../src/adapters/projects-sessions/TrackerMachineSamplerAdapter';
import { trackerResourceSample } from '../../../src/repositories/projects-sessions/tracker-machine-repository/trackerResourceSample';

test('reads Linux and macOS memory, swap and pressure', () => {
	expect(
		parseTrackerMeminfo(
			'MemTotal: 1000 kB\nMemFree: 100 kB\nMemAvailable: 400 kB\nSwapTotal: 50 kB\nSwapFree: 20 kB\n'
		)
	).toEqual({ total: 1_024_000, available: 409_600, swapTotal: 51_200, swapUsed: 30_720 });
	const vm = [
		'Mach Virtual Memory Statistics: (page size of 16384 bytes)',
		'Pages free:                 10.',
		'Pages inactive:             20.',
		'Pages speculative:           5.',
		'Pages wired down:          900.'
	].join('\n');
	expect(parseTrackerVmStat(vm)).toBe(35 * 16_384);
	expect(parseTrackerSwapUsage('total = 2.00G  used = 512.50M  free = 1.50G')).toEqual({
		swapTotal: 2 * 1024 ** 3,
		swapUsed: 512.5 * 1024 ** 2
	});
	expect(['1', '2', '4', ''].map(parseTrackerMemoryPressure)).toEqual([
		'normal',
		'warn',
		'critical',
		undefined
	]);
	expect(parseTrackerPressureFree('System-wide memory free percentage: 42%')).toBe(42);
});

test('groups agent sessions without keeping any command line', () => {
	const rows = parseTrackerProcesses(
		[
			'10 1 1024 1.0 -zsh',
			'11 10 2048 5.5 /Users/x/Library/Application Support/bin/claude',
			'12 11 1024 90.0 node',
			'20 1 4096 50,0 node',
			'30 1 512 1.0 node',
			'50 1 1024 210.0 /Applications/Xcode.app/Contents/Developer/Applications/Simulator.app/Contents/MacOS/Simulator',
			'51 50 4096 50.0 /Library/Developer/CoreSimulator/Volumes/iOS/launchd_sim',
			'60 1 4096 23.0 node',
			'61 60 2048 12.0 node',
			'62 1 4096 22.0 node'
		].join('\n')
	);
	const args = new Map([
		[12, 'node node_modules/.bin/vitest run --token=fixture-secret'],
		[20, 'node node_modules/.bin/vitest run'],
		[30, 'node server.js'],
		[60, 'node /tmp/harness-services-aa/helper.mjs --token=fixture-secret'],
		[62, 'node /tmp/harness-services-bb/helper.mjs']
	]);
	const groups = groupTrackerProcesses(rows, args, new Map([[10, 'auto-abc123-r4']]));
	expect(groups).toEqual([
		{
			kind: 'claude',
			pid: 11,
			label: 'claude in tmux:auto-abc123-r4',
			procs: 2,
			cpu: 95.5,
			rss_mb: 3
		},
		{ kind: 'test-runner', pid: 20, label: 'test-runner pid 20', procs: 1, cpu: 50, rss_mb: 4 }
	]);
	const system = groupTrackerSystemProcesses(rows, args, groups);
	expect(system).toEqual(
		expect.arrayContaining([
			expect.objectContaining({ label: 'iOS Simulator', procs: 2, cpu: 260, rss_mb: 5 }),
			expect.objectContaining({
				label: 'Orphaned Harness test helpers',
				procs: 3,
				cpu: 57,
				rss_mb: 10
			})
		])
	);
	expect(JSON.stringify([...groups, ...system])).not.toContain('fixture-secret');
});

test('a sample of this computer passes the fleet schema', async () => {
	const sample = await new TrackerMachineSamplerAdapter('fixture-node').sample(Date.now());
	expect(trackerResourceSample.parse(sample)).toEqual(sample);
	expect(sample.ram.total_mb).toBeGreaterThan(0);
	expect(sample.disks.length).toBeGreaterThan(0);
}, 30_000);

test('counts Claude Code launched from its versioned install path', () => {
	const path = '/Users/x/.local/share/claude/versions/2.1.332';
	const rows = parseTrackerProcesses(
		[`40 1 1024 2.0 ${path}`, '41 1 1024 1.0 2.1.332', '42 1 1024 1.0 9.9.9'].join('\n')
	);
	const args = new Map([
		[40, `${path} --model fixture`],
		[41, `${path} --model fixture`],
		[42, '/opt/other/9.9.9']
	]);
	expect(groupTrackerProcesses(rows, args, new Map()).map(({ kind, pid }) => [kind, pid])).toEqual([
		['claude', 40],
		['claude', 41]
	]);
});
