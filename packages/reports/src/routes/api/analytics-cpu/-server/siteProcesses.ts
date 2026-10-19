import { execFileSync } from 'node:child_process';
import { readlinkSync } from 'node:fs';
import type { CpuSnapshot } from '../../../../../../../src/utils/cpuMetrics';
import { ownedBySite } from '../../../../utils/reportSite';

/** The working directory of a process, or undefined when it cannot be told. */
function workingDirectory(pid: number): string | undefined {
	try {
		return readlinkSync(`/proc/${pid}/cwd`);
	} catch {
		// No /proc here; ask lsof, which prints the directory on a line that starts with `n`.
	}
	try {
		const output = execFileSync('lsof', ['-a', '-d', 'cwd', '-Fn', '-p', String(pid)], {
			encoding: 'utf8',
			stdio: ['ignore', 'pipe', 'ignore']
		});
		return output
			.split('\n')
			.find((line) => line.startsWith('n'))
			?.slice(1);
	} catch {
		return undefined;
	}
}

/**
 * A CPU sample as one site may see it: the machine totals stay, and of the agents only those
 * working in a checkout of this site's repository. An agent whose directory cannot be told is
 * left out, and the agents total is what the remaining ones add up to.
 */
export function siteProcesses(
	snapshot: CpuSnapshot,
	directoryOf: (pid: number) => string | undefined = workingDirectory
): CpuSnapshot {
	// A sample that could not be taken has no agents to attribute.
	if (!snapshot.agents || !snapshot.groups) return snapshot;
	const agents = snapshot.agents.filter((agent) => {
		const directory = directoryOf(agent.pid);
		return directory !== undefined && ownedBySite({ path: directory });
	});
	const sum = (pick: (agent: (typeof agents)[number]) => number) =>
		agents.reduce((total, agent) => total + pick(agent), 0);
	const groups = snapshot.groups.map((group) =>
		group.id === 'agents'
			? {
					...group,
					corePercent: sum((agent) => agent.corePercent),
					machinePercent: sum((agent) => agent.machinePercent),
					processes: sum((agent) => agent.processes)
				}
			: group
	);
	const trackedPercent =
		snapshot.trackedPercent === null
			? null
			: groups.reduce((total, group) => total + group.machinePercent, 0);
	return { ...snapshot, groups, agents, trackedPercent };
}
