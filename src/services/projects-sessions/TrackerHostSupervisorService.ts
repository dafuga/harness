// @harness-uid u_yyuondcf5b
import { rmSync, writeFileSync } from 'node:fs';
import { tryAcquireTrackerSqliteLease } from '../../adapters/projects-sessions/TrackerAdapterLeaseAdapter';
import type { TrackerHostSupervisorOptions } from './TrackerHostSupervisorService.types';
import { keepTrackerServing } from './tracker-host-supervisor-service/keepTrackerServing';
import { maintainTrackerHost } from './tracker-host-supervisor-service/maintainTrackerHost';

/** For hosts without a service manager: restart the service, rotate its log, check its health. */
export class TrackerHostSupervisorService {
	constructor(private readonly options: TrackerHostSupervisorOptions) {}

	/** Resolves 'already-running' at once when another supervisor holds this node. */
	async run(signal: AbortSignal): Promise<'stopped' | 'already-running'> {
		const release = tryAcquireTrackerSqliteLease(this.options.lockFile);
		if (!release) return 'already-running';
		try {
			writeFileSync(this.options.pidFile, `${process.pid}\n`, { mode: 0o600 });
			await Promise.all([
				keepTrackerServing(this.options, signal),
				maintainTrackerHost(this.options, signal)
			]);
			return 'stopped';
		} finally {
			rmSync(this.options.pidFile, { force: true });
			release();
		}
	}
}
