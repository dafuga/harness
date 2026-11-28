// @harness-uid u_fnfvgcje7d
import { existsSync, statfsSync, statSync } from 'node:fs';
import { availableParallelism, cpus, loadavg } from 'node:os';
import {
	groupTrackerProcesses,
	parseTrackerProcesses
} from '../../utils/projects-sessions/groupTrackerProcesses';
import type {
	TrackerDiskSample,
	TrackerProcessGroup,
	TrackerResourceSample
} from '../../utils/projects-sessions/trackerMachine.types';
import {
	readTrackerMemory,
	readTrackerMetricsCommand
} from './tracker-machine-sampler-adapter/readTrackerMemory';
import { trackerTmuxSockets } from './tracker-tmux-adapter/trackerTmuxPane';

const gib = 1024 ** 3;

/** Samples this computer's CPU, memory, swap, disks and agent sessions. */
export class TrackerMachineSamplerAdapter {
	private previous = cpuTimes();

	constructor(
		private readonly node: string,
		private readonly tmux = 'tmux'
	) {}

	async sample(now: number): Promise<TrackerResourceSample> {
		const times = cpuTimes();
		const busy = busyPercent(this.previous, times);
		this.previous = times;
		const [memory, groups] = await Promise.all([readTrackerMemory(), this.groups()]);
		return {
			at: new Date(now).toISOString(),
			platform: process.platform,
			cores: availableParallelism(),
			load: loadavg().map(round),
			cpu_busy_pct: busy,
			...memory,
			disks: diskSamples(),
			agents: agentCounts(groups),
			top_cpu: top(groups, 'cpu'),
			top_rss: top(groups, 'rss_mb')
		};
	}

	/** Command lines are read to classify processes and dropped before the sample leaves here. */
	private async groups(): Promise<TrackerProcessGroup[]> {
		const [table, commands, panes] = await Promise.all([
			readTrackerMetricsCommand('/bin/ps', ['-axo', 'pid=,ppid=,rss=,pcpu=,comm=']),
			readTrackerMetricsCommand('/bin/ps', ['-axo', 'pid=,args=']),
			this.panes()
		]);
		const args = new Map<number, string>();
		for (const line of commands.split('\n')) {
			const match = /^\s*(\d+)\s+(.*)$/.exec(line);
			if (match) args.set(Number(match[1]), match[2]);
		}
		return groupTrackerProcesses(parseTrackerProcesses(table), args, panes);
	}

	private async panes(): Promise<Map<number, string>> {
		const panes = new Map<number, string>();
		for (const socket of trackerTmuxSockets(this.node)) {
			const listed = await readTrackerMetricsCommand(this.tmux, [
				'-L',
				socket,
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

function top(groups: readonly TrackerProcessGroup[], key: 'cpu' | 'rss_mb') {
	return [...groups].sort((left, right) => right[key] - left[key]).slice(0, 5);
}

function round(value: number): number {
	return Math.round(value * 10) / 10;
}
