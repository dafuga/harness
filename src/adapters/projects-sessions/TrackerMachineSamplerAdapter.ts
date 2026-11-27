// @harness-uid u_fnfvgcje7d
import { execFile } from 'node:child_process';
import { existsSync, statfsSync, statSync } from 'node:fs';
import { availableParallelism, cpus, homedir, loadavg, tmpdir } from 'node:os';
import { join } from 'node:path';
import { trackerDiskAlertFloor } from '../../utils/projects-sessions/trackerMachineStatus';
import {
	groupTrackerProcesses,
	groupTrackerSystemProcesses,
	parseTrackerProcesses
} from '../../utils/projects-sessions/groupTrackerProcesses';
import type {
	TrackerDiskSample,
	TrackerDiskUser,
	TrackerSystemProcessGroup,
	TrackerProcessGroup,
	TrackerResourceSample
} from '../../utils/projects-sessions/trackerMachine.types';
import { readTrackerMemory } from './tracker-machine-sampler-adapter/readTrackerMemory';

const gib = 1024 ** 3;
const diskScanInterval = 15 * 60_000;

/** Samples this computer's CPU, memory, swap, disks and agent sessions. */
export class TrackerMachineSamplerAdapter {
	private previous = cpuTimes();
	private diskUsers: TrackerDiskUser[] = [];
	private nextDiskScan = -Infinity;

	constructor(
		private readonly node: string,
		private readonly tmux = 'tmux'
	) {}

	async sample(now: number): Promise<TrackerResourceSample> {
		const times = cpuTimes();
		const busy = busyPercent(this.previous, times);
		this.previous = times;
		const [memory, { agents, system }] = await Promise.all([readTrackerMemory(), this.groups()]);
		const disks = diskSamples();
		this.scanLowDisks(disks, now);
		return {
			at: new Date(now).toISOString(),
			platform: process.platform,
			cores: availableParallelism(),
			load: loadavg().map(round),
			cpu_busy_pct: busy,
			...memory,
			disks,
			agents: agentCounts(agents),
			top_cpu: top(agents, 'cpu'),
			top_rss: top(agents, 'rss_mb'),
			system_cpu: top(system, 'cpu'),
			system_rss: top(system, 'rss_mb'),
			system_groups: system.filter(({ procs }) => procs > 1),
			disk_users: this.diskUsers
		};
	}

	/** Start a bounded low-priority scan without delaying resource reports. */
	private scanLowDisks(disks: readonly TrackerDiskSample[], now: number) {
		const low = disks.filter(({ free_gb }) => free_gb < trackerDiskAlertFloor(process.platform));
		if (!low.length) {
			this.diskUsers = [];
			this.nextDiskScan = -Infinity;
			return;
		}
		if (now < this.nextDiskScan) return;
		this.nextDiskScan = now + diskScanInterval;
		void largestDiskUsers(low)
			.then((users) => (this.diskUsers = users))
			.catch(() => {});
	}

	/** Command lines are read to classify processes and dropped before the sample leaves here. */
	private async groups() {
		const [table, commands, panes] = await Promise.all([
			read('/bin/ps', ['-axo', 'pid=,ppid=,rss=,pcpu=,comm=']),
			read('/bin/ps', ['-axo', 'pid=,args=']),
			this.panes()
		]);
		const args = new Map<number, string>();
		for (const line of commands.split('\n')) {
			const match = /^\s*(\d+)\s+(.*)$/.exec(line);
			if (match) args.set(Number(match[1]), match[2]);
		}
		const rows = parseTrackerProcesses(table);
		const agents = groupTrackerProcesses(rows, args, panes);
		return { agents, system: groupTrackerSystemProcesses(rows, args, agents) };
	}

	private async panes(): Promise<Map<number, string>> {
		const panes = new Map<number, string>();
		const sockets = this.node === 'harbor-mbp-2' ? [[], ['-L', 'claude']] : [[]];
		for (const socket of sockets) {
			const listed = await read(this.tmux, [
				...socket,
				'list-panes',
				'-a',
				'-F',
				'#{pane_pid} #{session_name}'
			]);
			for (const line of listed.split('\n')) {
				const match = /^(\d+) ([\w.:@-]+)/.exec(line);
				if (match) panes.set(Number(match[1]), match[2]);
			}
		}
		return panes;
	}
}

/** A missing tool or an absent tmux server leaves its reading empty. */
function read(command: string, args: string[]): Promise<string> {
	return new Promise((resolve) => {
		execFile(command, args, { timeout: 10_000, maxBuffer: 16 * 1024 * 1024 }, (error, stdout) =>
			resolve(error ? '' : stdout)
		);
	});
}

function cpuTimes() {
	let busy = 0;
	let total = 0;
	for (const { times } of cpus()) {
		const all = times.user + times.nice + times.sys + times.idle + times.irq;
		total += all;
		busy += all - times.idle;
	}
	return { busy, total };
}

function busyPercent(before: ReturnType<typeof cpuTimes>, after: ReturnType<typeof cpuTimes>) {
	const elapsed = after.total - before.total;
	return elapsed > 0 ? round((100 * (after.busy - before.busy)) / elapsed) : null;
}

function diskSamples(): TrackerDiskSample[] {
	const mounts =
		process.platform === 'darwin' ? ['/System/Volumes/Data'] : ['/', '/workspace', '/home'];
	const seen = new Set<number>();
	return mounts.filter(existsSync).flatMap((mount) => {
		const { dev } = statSync(mount);
		if (seen.has(dev)) return [];
		seen.add(dev);
		const { blocks, bavail, bsize } = statfsSync(mount);
		return [
			{
				mount,
				total_gb: round((blocks * bsize) / gib),
				free_gb: round((bavail * bsize) / gib),
				free_pct: blocks ? round((100 * bavail) / blocks) : 0
			}
		];
	});
}

/** Only scan known workspace and cache directories on the constrained volume. */
async function largestDiskUsers(disks: readonly TrackerDiskSample[]): Promise<TrackerDiskUser[]> {
	const home = homedir();
	const volumes = new Set(
		disks.map(({ mount }) => statSync(mount, { throwIfNoEntry: false })?.dev)
	);
	volumes.delete(undefined);
	const directories = new Map([
		[join(home, 'projects'), 'Projects'],
		[join(home, '.local/state/harness'), 'Harness state and worktrees'],
		[join(home, 'Library/Developer'), 'Xcode and simulator data'],
		[join(home, 'Library/Caches'), 'User caches'],
		[join(home, '.cache'), 'User cache directory'],
		['/workspace', 'Workspace'],
		[tmpdir(), 'Temporary files']
	]);
	const users: TrackerDiskUser[] = [];
	for (const [path, label] of directories) {
		if (!volumes.has(statSync(path, { throwIfNoEntry: false })?.dev)) continue;
		const used = await diskUsageKB(path);
		if (used !== undefined) users.push({ label, used_gb: round(used / 1024 ** 2) });
	}
	return users.sort((left, right) => right.used_gb - left.used_gb).slice(0, 3);
}

function diskUsageKB(path: string): Promise<number | undefined> {
	return new Promise((resolve) => {
		execFile(
			'/usr/bin/nice',
			['-n', '15', '/usr/bin/du', '-skx', path],
			{ timeout: 3_000, killSignal: 'SIGKILL', maxBuffer: 64 * 1024 },
			(error, stdout) => {
				const match = /^(\d+)\s/.exec(stdout);
				resolve(!error && match ? Number(match[1]) : undefined);
			}
		);
	});
}

function agentCounts(groups: readonly TrackerProcessGroup[]) {
	const count = (kind: TrackerProcessGroup['kind']) =>
		groups.filter((group) => group.kind === kind).length;
	return {
		claude: count('claude'),
		codex: count('codex'),
		test_runners: count('test-runner'),
		browsers: count('browser')
	};
}

function top<T extends TrackerSystemProcessGroup>(groups: readonly T[], key: 'cpu' | 'rss_mb') {
	return [...groups].sort((left, right) => right[key] - left[key]).slice(0, 5);
}

function round(value: number): number {
	return Math.round(value * 10) / 10;
}
