import type { TrackerPlacedLaunch, TrackerFleetView } from './trackerLaunchPlacement.types';
// @harness-uid u_5hr7siszzq
import { classifyTrackerTask, sizeOf } from '../../../utils/agents-providers/classifyTrackerTask';
import { pickTrackerModel } from '../../../utils/agents-providers/pickTrackerModel';
import type { TrackerModelItem } from '../../../utils/agents-providers/classifyTrackerTask.types';
import type {
	TrackerMachineRow,
	TrackerPlacementCandidate,
	TrackerWorkKind
} from '../../../utils/projects-sessions/trackerMachine.types';
import { trackerMacLaunchLoad } from '../../../utils/projects-sessions/trackerMachineStatus';
import { trackerCpuBudget } from '../../../utils/projects-sessions/trackerCpuBudget';
import { trackerMachineSample } from '../tracker-native-runtime-service/trackerFleetSampleSchema';

const runnerAge = 120_000;
const preferred = 60;
const lightKinds = new Set(['docs', 'chore', 'triage']);
const browserWork = /\b(browser|playwright|e2e)\b/i;

/**
 * The best computer for a task, among those whose launcher is polling, maps the task's project
 * and has a free slot. Heavy work prefers the primary Mac and light work the shared box.
 * Returns undefined when none is known to fit, or when the task names a local checkout.
 */
export function trackerLaunchPlacement(
	item: TrackerModelItem & { repo?: string | null },
	view: TrackerFleetView
): TrackerPlacedLaunch | undefined {
	if (item.repo) return undefined;
	const project = (item.project ?? item.agent)?.toLowerCase();
	const cli = pickedCli(item, view.now());
	if (!project || !cli) return undefined;
	const eligible = launcherNodes(view, project);
	const work = workShape(item, cli);
	const placement = view.machines.place({
		kind: work.kind,
		needsRamGB: work.light ? 1 : undefined
	});
	const rows = new Map(view.machines.rows().map((row) => [row.node, row]));
	const [best] = placement.ranked
		.filter(
			(entry) =>
				entry.fits && eligible.has(entry.node) && macHeadroom(rows.get(entry.node), project)
		)
		.map((entry) => ({ entry, score: (entry.score ?? 0) + bonus(entry, work) }))
		.sort((left, right) => right.score - left.score);
	if (!best) return undefined;
	const reasons = best.entry.reasons.slice(0, 2).join('; ');
	return { node: best.entry.node, why: `${work.label} work; ${reasons}` };
}

function pickedCli(item: TrackerModelItem, now: number): string | undefined {
	try {
		return pickTrackerModel(item, { now }).rung.cli;
	} catch {
		return undefined;
	}
}

function launcherNodes(view: TrackerFleetView, project: string): Set<string> {
	const now = view.now();
	const fresh = (at?: string | null) => Boolean(at) && Math.abs(now - Date.parse(at!)) <= runnerAge;
	return new Set(
		view.samples().flatMap((value) => {
			const sample = trackerMachineSample.safeParse(value).data;
			if (!sample || !fresh(sample.at)) return [];
			const { enabled, last_error, last_tick_at, capacity } = sample.runner;
			if (!enabled || last_error || !fresh(last_tick_at)) return [];
			return capacity?.freeSlots && capacity.projects[project] ? [sample.node] : [];
		})
	);
}

function workShape(item: TrackerModelItem, cli: string) {
	const kind = classifyTrackerTask(item);
	const browser = browserWork.test(`${item.title ?? ''} ${item.notes ?? ''}`);
	const heavy = browser || kind === 'hard' || kind === 'refactor' || sizeOf(item) === 'large';
	const light = !heavy && lightKinds.has(kind);
	return {
		heavy,
		light,
		kind: placementKind({ browser, heavy, light, cli }),
		label: `${weight(heavy, light)} ${kind}`
	};
}

function weight(heavy: boolean, light: boolean): string {
	if (heavy) return 'heavy';
	return light ? 'light' : 'normal';
}

function placementKind(work: {
	browser: boolean;
	heavy: boolean;
	light: boolean;
	cli: string;
}): TrackerWorkKind {
	if (work.browser) return 'browser-tests';
	if (work.heavy) return 'build';
	if (work.light) return 'general';
	return work.cli === 'codex' ? 'codex' : 'claude';
}

function bonus(entry: TrackerPlacementCandidate, work: { heavy: boolean; light: boolean }) {
	if (work.heavy && entry.role === 'primary') return preferred;
	return work.light && entry.role === 'shared' ? preferred : 0;
}

/** A Mac needs 25% free memory and a one-minute load under 15 to take new work. */
function macHeadroom(row: TrackerMachineRow | undefined, project: string): boolean {
	if (row?.role !== 'primary' && row?.role !== 'runner') return true;
	if (!row.sample) return false;
	const { ram, load } = row.sample;
	const limit = trackerCpuBudget(row.node, project) ?? trackerMacLaunchLoad;
	return (ram.pressure_free_pct ?? ram.available_pct) >= 25 && load[0] < limit;
}
