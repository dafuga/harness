import { buildObservation, type BuildObservation } from './ios-build-observation';
import { join } from 'node:path';
import { classifyProcess, platformServices } from "../../../src/utils/run-isolated/platformServices";
import { type ServiceContext } from "../../../src/utils/platformServices";
import { processDescendants } from "../../../src/utils/run-isolated/processDescendants";
import { type TrackedProcess } from "../../../src/utils/processDescendants";

interface SeenService {
	started: string;
	executable: string;
}
const same = (one: TrackedProcess, other: TrackedProcess) =>
	one.pid === other.pid && one.started === other.started;

/** Observation only: these existing services are never owned or signalled by this build. */
export async function observeIosServices(
	rows: Map<number, SeenService> | null,
	group: number
): Promise<BuildObservation> {
	if (!rows) throw new Error('The services before the build could not be observed.');
	const authority = await platformServices();
	// No authority can admit a preexisting service. The build's own descendants still settle.
	if (!authority) return buildObservation(async () => true);
	const paths = authority.services.map((service) => join(authority.root, service.path));
	const watching: WatchedService[] = [];
	for (const [pid, row] of rows) {
		if (!paths.includes(row.executable)) continue;
		const known = { pid, started: row.started };
		const verdict = await classifyProcess(known, {
			authority: () => authority,
			group
		});
		if (verdict.standing !== 'delegated')
			throw new Error('An existing build service could not be attested for observation.');
		const watch = processDescendants(pid);
		const initial = await watch.alive();
		const anchored = initial?.some((item) => same(item, known) && item.proven);
		watch.closed();
		if (!anchored) throw new Error('An existing build service changed before observation.');
		watching.push({ known, watch });
	}
	return buildObservation(async (signal) => {
		const clear = await Promise.all(
			watching.map((item) => clearService(item, { authority: () => authority, group, signal }))
		);
		return !signal.aborted && clear.every(Boolean);
	});
}

interface WatchedService {
	known: TrackedProcess;
	watch: ReturnType<typeof processDescendants>;
}
/** A helper is waited for, never delegated merely because a service started it. */
async function clearService({ known, watch }: WatchedService, context: ServiceContext) {
	const alive = await watch.alive();
	if (!alive || context.signal?.aborted) return false;
	if (!alive.every((item) => same(item, known))) return false;
	if (alive.length === 0) return true;
	return (await classifyProcess(known, context)).standing === 'delegated';
}
