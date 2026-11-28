// @harness-uid u_gvqtr5mdwv
import { TrackerAdapterSourceRepository } from '../../../repositories/projects-sessions/TrackerAdapterSourceRepository';
import { TrackerRunReadRepository } from '../../../repositories/projects-sessions/TrackerRunReadRepository';
import { ladderFrom } from '../../../utils/agents-providers/parseTrackerModelSpec';
import { trackerNodeNames } from '../../agents-providers/tracker-dispatcher-service/launchEligibility';
import { readTrackerDuePreview } from '../tracker-native-runtime-service/readTrackerDuePreview';
import {
	trackerCodexPause,
	trackerQuotaHold
} from '../tracker-native-runtime-service/trackerProviderHolds';
import { activeTrackerProviderPreference } from '../tracker-native-runtime-service/trackerProviderPreference';
import type { TrackerNativeRuntimeService } from '../TrackerNativeRuntimeService';
import type { TrackerSupervisorService } from '../TrackerSupervisorService';
import { readTrackerBackupList } from './readTrackerBackupList';

export function readTrackerNodeInspection(
	path: string,
	runtime: TrackerNativeRuntimeService,
	supervisor: TrackerSupervisorService
): Response | undefined {
	switch (path) {
		case '/autolaunch':
			return Response.json(autolaunchStatus(runtime, supervisor));
		case '/autolaunch/preference':
			return Response.json({
				provider_preference: activeTrackerProviderPreference(runtime.store, runtime.now())
			});
		case '/autolaunch/dry-run':
			return Response.json(readTrackerDuePreview(runtime));
		case '/adapters':
			return adapterList(runtime);
		case '/backup/list':
			return Response.json(backupList(runtime));
		default:
			return undefined;
	}
}

function backupList({
	backups: { directory, externalDirectory, service }
}: TrackerNativeRuntimeService) {
	const hub = service && { status: service.status(), externalDirectory };
	return readTrackerBackupList(directory, hub);
}

function autolaunchStatus(
	runtime: TrackerNativeRuntimeService,
	supervisor: TrackerSupervisorService
) {
	const { store, role, scheduler } = runtime;
	const runs = new TrackerRunReadRepository(store.database, store.node);
	const active = runs.activeLocal();
	const status = supervisor.status().autolaunch;
	return {
		...status,
		role:
			role === 'hub'
				? 'hub: assigns items and runs its own'
				: 'runner: launches items assigned to this computer',
		names: trackerNodeNames(store.node, role === 'hub'),
		quota_holds: {
			codex: trackerQuotaHold(store, 'codex'),
			claude: trackerQuotaHold(store, 'claude')
		},
		...trackerCodexPause(store, runtime.now()),
		provider_preference: activeTrackerProviderPreference(store, runtime.now()),
		scheduler: readTrackerDuePreview(runtime),
		active: active.map((run) => ({
			run: run.id,
			item: run.item_id,
			state: run.state,
			rung: run.rung,
			tmux: run.tmux ?? null
		})),
		ladder: ladderFrom(runtime.ladderConfig).map(
			({ id, model, effort }) => `${id}=${model}${effort ? ':' + effort : ''}`
		),
		waiting_on: scheduler?.runnerStatus().waiting_on ?? null,
		pending_events: runs.pendingEvents()
	};
}

function adapterList({ store, adapter }: TrackerNativeRuntimeService) {
	const sources = new TrackerAdapterSourceRepository(store.database);
	const storedRunner = sources.runner();
	const configured = adapter?.status();
	if ((configured && !configured.active) || (storedRunner ?? configured?.runner) !== store.node)
		return Response.json(
			{ error: 'configure and run adapters on the designated Tracker runner' },
			{ status: 409 }
		);
	return Response.json(sources.list(store.node));
}
