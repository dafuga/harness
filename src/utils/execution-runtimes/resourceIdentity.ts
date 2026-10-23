import type { ResourceJob } from '../../core/execution-runtimes/resourceTypes';
import { processTable, type ProcessRow } from '../development-tooling/processDescendants';
const same = (a: string, b: string) => a.replace(/\s+/g, ' ') === b.replace(/\s+/g, ' ');
export async function resourceIdentity(job: ResourceJob): Promise<boolean> {
	const rows = await processTable();
	if (!rows) return false;
	const owner = rows.find((r) => r.pid === job.ownerPid);
	if (!owner || !same(owner.started, job.ownerStarted)) return false;
	const byPid = new Map(rows.map((r) => [r.pid, r])),
		seen = new Set<number>();
	let current = byPid.get(process.pid);
	while (current && !seen.has(current.pid)) {
		if (current.pid === owner.pid) return true;
		seen.add(current.pid);
		current = byPid.get(current.parent);
	}
	return false;
}
export function abandonedResources(
	jobs: ResourceJob[],
	rows: ProcessRow[],
	now = Date.now()
): string[] {
	const alive = (pid: number, started: string) =>
		rows.some((r) => r.pid === pid && same(r.started, started));
	return jobs
		.filter(
			(j) =>
				now - j.heartbeatAt > 30000 &&
				!alive(j.ownerPid, j.ownerStarted) &&
				(!j.workerPid ||
					(j.workerStarted
						? !alive(j.workerPid, j.workerStarted)
						: !rows.some((r) => r.pid === j.workerPid)))
		)
		.map((j) => j.id);
}
