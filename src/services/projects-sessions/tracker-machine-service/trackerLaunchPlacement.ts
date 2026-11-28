import type {
	TrackerPlacedLaunch,
	TrackerFleetView,
	TrackerPlacementReservation
} from './trackerLaunchPlacement.types';
// @harness-uid u_5hr7siszzq
import {
	classifyTrackerTask,
	sizeOf,
	trackerTaskRoute
} from '../../../utils/agents-providers/classifyTrackerTask';
import { pickTrackerModel } from '../../../utils/agents-providers/pickTrackerModel';
import type { TrackerModelItem } from '../../../utils/agents-providers/classifyTrackerTask.types';
import type { TrackerWorkKind } from '../../../utils/projects-sessions/trackerMachine.types';
import { trackerMachineSample } from '../tracker-native-runtime-service/trackerFleetSampleSchema';

const runnerAge = 120_000;
const lightKinds = new Set(['docs', 'chore', 'triage']);
const browserWork = /\b(browser|playwright|e2e)\b/i;
const buildWork = /^(?:please\s+)?(?:run|start|execute)\b[^\n.!?]*\b(?:builds?|tests?|suites?)\b/i;
const desktopChrome = /\b(?:chrome|chromium|cdp)\b/i;

/** Desktop computer-use requires the primary Mac's browser and session. */
export function trackerDesktopLaunchHost(item: TrackerModelItem): string | undefined {
	if (
		trackerTaskRoute(item) === 'computer-use' ||
		desktopChrome.test(`${item.title ?? ''} ${item.notes ?? ''}`)
	)
		return 'daniel-primary-mbp';
}

/**
 * The best computer for a task, among those whose launcher is polling, maps the task's project
 * and has a free slot. The score uses the work estimate and both host resources.
 * Returns undefined when none is known to fit, or when the task names a local checkout.
 */
export function trackerLaunchPlacement(
	item: TrackerModelItem & { repo?: string | null },
	view: TrackerFleetView,
	reserved?: ReadonlyMap<string, TrackerPlacementReservation>
): TrackerPlacedLaunch | undefined {
	if (item.repo) return undefined;
	const project = (item.project ?? item.agent)?.toLowerCase();
	const cli = pickedCli(item, view.now());
	if (!project || !cli) return undefined;
	const sessionSlots = launcherNodes(
		view,
		{ project, onlyNode: trackerDesktopLaunchHost(item) },
		reserved
	);
	const work = workShape(item, cli);
	const placement = view.machines.place({
		kind: work.kind,
		reserved,
		sessionSlots,
		agentSession: !work.heavy
	});
	const best = placement.ranked.find(({ fits }) => fits);
	if (!best) return undefined;
	const reasons = best.reasons.slice(0, 2).join('; ');
	return {
		node: best.node,
		why: `${work.label} work; ${reasons}`,
		demand: { cores: placement.needs_cores, ramGB: placement.needs_ram_gb }
	};
}

function pickedCli(item: TrackerModelItem, now: number): string | undefined {
	try {
		return pickTrackerModel(item, { now }).rung.cli;
	} catch {
		return undefined;
	}
}

function launcherNodes(
	view: TrackerFleetView,
	{ project, onlyNode }: { project: string; onlyNode?: string },
	reserved?: ReadonlyMap<string, TrackerPlacementReservation>
): Map<string, number> {
	const now = view.now();
	const fresh = (at?: string | null) => Boolean(at) && Math.abs(now - Date.parse(at!)) <= runnerAge;
	return new Map(
		view.samples().flatMap((value) => {
			const sample = trackerMachineSample.safeParse(value).data;
			if (!sample || !fresh(sample.at) || (onlyNode && sample.node !== onlyNode)) return [];
			const { enabled, last_error, last_tick_at, capacity } = sample.runner;
			if (!enabled || last_error || !fresh(last_tick_at)) return [];
			const slots = (capacity?.freeSlots ?? 0) - (reserved?.get(sample.node)?.sessions ?? 0);
			return slots > 0 && capacity?.projects[project] ? [[sample.node, slots] as const] : [];
		})
	);
}

function workShape(item: TrackerModelItem, cli: string) {
	const kind = classifyTrackerTask(item);
	const browser = browserWork.test(`${item.title ?? ''} ${item.notes ?? ''}`);
	const heavy =
		browser ||
		kind === 'hard' ||
		kind === 'refactor' ||
		buildWork.test(item.title ?? '') ||
		sizeOf(item) === 'large';
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
