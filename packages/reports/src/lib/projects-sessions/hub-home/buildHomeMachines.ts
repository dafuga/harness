// @harness-uid u_olskun75lm
import type {
	TrackerMachineRecord,
	TrackerRunRecord,
	TrackerSources
} from '../project-overview/projectOverviewTracker.types';
import { compareOverviewMachines } from '../project-overview/projectOverviewItems';
import type { HomeComputer, HomeComputerSession } from './homeLive.types';
import { homeText } from './homeTrackerText';

const maxListedSessions = 100;

export function isActiveHomeRun(run: TrackerRunRecord): boolean {
	return run.ended_at === null && ['running', 'verifying', 'observed'].includes(run.state);
}

/** Attribute active runs by origin and by the destination of each active host-work lease. */
export function buildHomeMachines(
	sources: TrackerSources,
	runs: Map<string, TrackerRunRecord[]>,
	listed: ReadonlySet<string>
): HomeComputer[] {
	const titles = new Map(
		sources.items.filter(({ id }) => listed.has(id)).map(({ id, title }) => [id, title])
	);
	const all = [...runs.values()].flat();
	const byNode = Map.groupBy(all.filter(isActiveHomeRun), (run) => run.node);
	const byKey = new Map(all.map((run) => [runKey(run), run]));
	return sources.machines
		.map((machine) => homeComputer(machine, byNode.get(machine.node) ?? [], byKey, titles))
		.sort(compareOverviewMachines);
}

function runKey({ node, id }: Pick<TrackerRunRecord, 'node' | 'id'>) {
	return `${node}:${id}`;
}

function homeComputer(
	machine: TrackerMachineRecord,
	local: TrackerRunRecord[],
	known: ReadonlyMap<string, TrackerRunRecord>,
	titles: ReadonlyMap<string, string>
): HomeComputer {
	const { node, status, remoteRuns, remoteRunRefs, resources } = machine;
	const reasons = machine.reasons?.flatMap((reason) => homeText(reason, 200) ?? []);
	const name = homeText(node, 200) ?? '';
	if (status === 'offline') return { name, status, reasons };
	const runs = new Map<string, TrackerRunRecord | undefined>(
		local.map((run) => [runKey(run), run])
	);
	for (const ref of remoteRunRefs ?? []) {
		const key = runKey(ref);
		const run = known.get(key);
		if (!run || isActiveHomeRun(run)) runs.set(key, run);
	}
	const sessions = [...runs].flatMap(([key, run]): HomeComputerSession[] => {
		if (!run) return [];
		const title = homeText(titles.get(run.item_id), 500);
		return title ? [{ key: homeText(key, 300) ?? '', title, origin: homeText(run.node, 200) }] : [];
	});
	return {
		name,
		status,
		reasons,
		resources,
		remoteRuns,
		agentCount: runs.size + (remoteRunRefs ? 0 : (remoteRuns ?? 0)),
		sessions: sessions.slice(0, maxListedSessions)
	};
}
