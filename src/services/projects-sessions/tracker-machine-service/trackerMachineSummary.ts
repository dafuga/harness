// @harness-uid u_ozo3bmxmpo
import { trackerMachineTargets } from '../../../utils/projects-sessions/placeTrackerWork';
import { trackerActualUtilization } from '../../../utils/projects-sessions/trackerMachineStatus';
import type { TrackerMachineRow } from '../../../utils/projects-sessions/trackerMachine.types';

/** One computer without its process groups, for lists and service status. */
export function trackerMachineSummary(row: TrackerMachineRow) {
	const { node, role, status, reasons, age_s, remote_runs, remote_run_refs, sample } = row;
	return {
		node,
		role,
		status,
		reasons,
		age_s,
		remote_runs,
		remote_run_refs,
		...(sample && {
			cores: sample.cores,
			...(status !== 'offline' && {
				utilization: {
					actual: trackerActualUtilization(sample),
					target: trackerMachineTargets(row, sample)
				}
			}),
			load: sample.load,
			cpu_busy_pct: sample.cpu_busy_pct,
			ram: sample.ram,
			swap: sample.swap,
			disks: sample.disks,
			agents: sample.agents
		})
	};
}
