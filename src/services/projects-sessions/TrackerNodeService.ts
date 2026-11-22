// @harness-uid u_gvqtr5mdwv
import { openSqlite } from '../../adapters/development-tooling/openSqlite';
import { tryAcquireTrackerSqliteLease } from '../../adapters/projects-sessions/TrackerAdapterLeaseAdapter';
import { TrackerNativeRuntimeService } from './TrackerNativeRuntimeService';
import type { TrackerNodeOwner, TrackerNodeOwnership } from './TrackerNodeService.types';
import { TrackerSupervisorService } from './TrackerSupervisorService';
import {
	trackerSyncPort,
	verifyTrackerDatabasePath,
	verifyTrackerJournalWritable,
	verifyTrackerLegacyFence
} from './tracker-node-service/trackerNodeConfig';
import type { TrackerNodeConfig } from './tracker-node-service/trackerNodeConfig.types';
import {
	bindTrackerListener,
	trackerNodeApi,
	trackerNodeSync,
	unavailable
} from './tracker-node-service/trackerNodeListeners';
import { trackerNodeOwnership } from './tracker-node-service/trackerNodeOwnership';
import { trackerNodeRuntime } from './tracker-node-service/trackerNodeRuntime';
import { TrackerNodeStartupError } from './tracker-node-service/TrackerNodeStartupError';
import { holdLegacySupervisorSocket } from './tracker-node-service/holdLegacySupervisorSocket';

/** Owns the foreground Tracker node, both listeners, and its journal lease. */
export class TrackerNodeService {
	async start(config: TrackerNodeConfig): Promise<TrackerNodeOwner> {
		const checkpoint = verifyTrackerLegacyFence(config);
		verifyTrackerDatabasePath(config.database);
		verifyTrackerJournalWritable(config.database);
		const options = trackerNodeRuntime(config);
		const release = tryAcquireTrackerSqliteLease(config.database + '.supervisor-lock.sqlite');
		if (!release) throw new TrackerNodeStartupError('Tracker journal is already owned');

		const owner = trackerNodeOwnership(release);
		try {
			const ports = await bindTrackerNode(config, owner, checkpoint);
			owner.database = openSqlite(config.database);
			owner.runtime = new TrackerNativeRuntimeService(owner.database, options);
			owner.supervisor = new TrackerSupervisorService(owner.runtime, {
				onError: (name) => console.error(`tracker: ${name} tick failed`)
			});
			owner.workers = owner.supervisor.run(owner.lifetime);
			return {
				node: config.node,
				...ports,
				pid: process.pid,
				checkpoint,
				workers: owner.workers,
				close: () => owner.close(true)
			};
		} catch (error) {
			await owner.close(false);
			throw error;
		}
	}
}

async function bindTrackerNode(
	config: TrackerNodeConfig,
	owner: TrackerNodeOwnership,
	checkpoint: string
) {
	if (config.legacySupervisorSocket)
		owner.releaseSocket = await holdLegacySupervisorSocket(config.legacySupervisorSocket);
	const api = bindTrackerListener(config.apiPort, 'api', owner.lifetime, (request) =>
		owner.runtime && owner.supervisor
			? trackerNodeApi(request, owner.runtime, owner.supervisor, checkpoint)
			: unavailable()
	);
	owner.listeners.push(api);
	const syncPort = trackerSyncPort(config);
	if (syncPort !== undefined) {
		const sync = bindTrackerListener(syncPort, 'sync', owner.lifetime, (request) =>
			owner.runtime ? trackerNodeSync(request, owner.runtime) : unavailable()
		);
		owner.listeners.push(sync);
	}
	return { port: api.port, syncPort };
}
