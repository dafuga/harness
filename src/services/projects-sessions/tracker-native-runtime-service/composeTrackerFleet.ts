// @harness-uid u_hcvkvdj37h
import type { TrackerRunReadRepository } from '../../../repositories/projects-sessions/TrackerRunReadRepository';
import { trackerResourceHoldPrefix } from '../../../utils/projects-sessions/trackerHostResourceHold';
import type {
	TrackerDispatchItem,
	TrackerDispatchPolicy
} from '../../agents-providers/TrackerDispatcherService.types';
import { canonicalNode } from '../../agents-providers/tracker-dispatcher-service/launchEligibility';
import { trackerHostCapacityHold } from './trackerHostAdmission';
import { trackerMachineSample } from './trackerFleetSampleSchema';
import { trackerLaunchPlacement } from '../tracker-machine-service/trackerLaunchPlacement';
import { assignTrackerLaunches } from '../tracker-machine-service/assignTrackerLaunches';
import { placeTrackerAutoLaunch } from '../tracker-machine-service/placeTrackerAutoLaunch';
import type { TrackerFleetView } from '../tracker-machine-service/trackerLaunchPlacement.types';
import type { TrackerDispatchSchedulerService } from '../TrackerDispatchSchedulerService';
import type { TrackerMachineService } from '../TrackerMachineService';
import type { TrackerNativeRuntimeOptions } from '../TrackerNativeRuntimeService.types';
import { composeTrackerTelemetry } from './nativeTrackerTelemetry';
import { recordingFleetStore } from './trackerFleetTelemetry';

/** Wire fleet telemetry, placement of `auto` launches and the hub's assignment of the rest. */
export function composeTrackerFleet(
	runs: TrackerRunReadRepository,
	options: TrackerNativeRuntimeOptions,
	runtime: {
		machines: TrackerMachineService;
		scheduler?: TrackerDispatchSchedulerService;
		now: () => number;
	}
) {
	const { machines, scheduler, now } = runtime;
	const received = options.syncResponder?.machines;
	const fleet = received && recordingFleetStore(received, machines);
	const telemetry = composeTrackerTelemetry(machines.store, runs, options, {
		machines,
		fleet,
		scheduler
	});
	const view: TrackerFleetView = { machines, now, samples: () => telemetry.samples?.() ?? [] };
	return {
		samples: telemetry.samples,
		tick: withAssignment(telemetry.tick, view, options),
		syncOptions: fleet
			? { ...options, syncResponder: { ...options.syncResponder!, machines: fleet } }
			: options,
		apiOptions: (api: TrackerNativeRuntimeOptions): TrackerNativeRuntimeOptions =>
			api.planLaunch ? { ...api, planLaunch: placeTrackerAutoLaunch(api.planLaunch, view) } : api
	};
}

function withAssignment(
	tick: ((signal: AbortSignal) => Promise<void>) | undefined,
	view: TrackerFleetView,
	{ role, dispatch }: TrackerNativeRuntimeOptions
) {
	if (!tick || role !== 'hub' || !dispatch) return tick;
	return async (signal: AbortSignal) => {
		await tick(signal);
		signal.throwIfAborted();
		assignTrackerLaunches(view);
	};
}

/** A preferred Mac owns its due decision and can hand it to a healthy Mac before reserving a run. */
export function chooseTrackerFleetHost(
	policy: TrackerDispatchPolicy,
	view: TrackerFleetView
): TrackerDispatchPolicy['chooseHost'] {
	return (item, scope) => {
		const choice = policy.chooseHost(item, scope);
		const preferred = scope.requestedNode;
		if (!preferred || !portableMacPreference(item, scope.source, preferred)) return choice;
		const held =
			preferred === policy.node
				? localPlacementHold(item, scope.source, policy)
				: view.machines.peerStartHold(preferred);
		if (!held) return choice;
		const alternate = trackerLaunchPlacement(item, {
			...view,
			samples: () => view.samples().filter((raw) => eligibleMac(raw, view, preferred))
		});
		return alternate
			? { node: alternate.node, why: `${preferred} held (${held}); placed on ${alternate.node}` }
			: { node: preferred === policy.node ? null : choice.node, why: held };
	};
}

function portableMacPreference(
	item: TrackerDispatchItem,
	source: string,
	preferred: string
): source is 'due' | 'automatic' {
	return (
		!item.sensitive &&
		!item.repo &&
		!item.adapterDueOwner &&
		isMac(preferred) &&
		(source === 'due' || source === 'automatic')
	);
}

function eligibleMac(raw: unknown, { machines }: TrackerFleetView, preferred: string) {
	const sample = trackerMachineSample.safeParse(raw).data;
	return (
		sample &&
		sample.node !== preferred &&
		isMac(sample.node) &&
		sample.runner.automatic_enabled === true &&
		!machines.peerStartHold(sample.node)
	);
}

function isMac(node: string) {
	return node === 'daniel-primary-mbp' || node === 'harbor-mbp-2';
}

function localPlacementHold(
	item: TrackerDispatchItem,
	source: 'due' | 'automatic',
	policy: TrackerDispatchPolicy
) {
	const picked = policy.pickModel(item);
	if ('error' in picked) return null;
	const target = canonicalNode(policy.node, policy);
	const held = policy.admit(item, { source, target, token: '' }, picked.rung);
	return held === trackerHostCapacityHold || held?.startsWith(trackerResourceHoldPrefix)
		? held
		: null;
}
