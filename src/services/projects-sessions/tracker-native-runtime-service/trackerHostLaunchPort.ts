// @harness-uid u_bl6xl2h4a3
import { TrackerHostProcessAdapter } from '../../../adapters/projects-sessions/TrackerHostProcessAdapter';
import { trackerManagedHostLauncher } from '../../../adapters/projects-sessions/tracker-tmux-adapter/trackerManagedHostLauncher';
import type {
	TrackerHostLaunchConfig,
	TrackerWorkerClient
} from './nativeTrackerHostEffects.types';
import type { TrackerHostLaunchPort } from './trackerHostLaunch.types';
import { hostInventory, hostStart } from './trackerHostLaunchSchema';
import type { TrackerItemReadRepository } from '../../../repositories/projects-sessions/TrackerItemReadRepository';
import type {
	TrackerDispatchEvent,
	TrackerRunReceipt
} from '../../agents-providers/TrackerDispatcherService.types';

export function trackerHostLaunchPort(
	config: TrackerHostLaunchConfig,
	client?: TrackerWorkerClient,
	transcriptRoots?: readonly string[]
): TrackerHostLaunchPort {
	if ('managed' in config) {
		if (!client)
			throw new TypeError('Tracker managed launcher needs the verified local client address');
		return trackerManagedHostLauncher(config.managed, { client, transcriptRoots });
	}
	const driver = new TrackerHostProcessAdapter(config.driver);
	return {
		async inspect(input, signal) {
			return hostInventory.parse(await driver.request('inspect', input, signal));
		},
		async start(input, signal) {
			return hostStart.parse(await driver.request('start', input, signal));
		}
	};
}

export async function withTrackerRunUsage(
	event: TrackerDispatchEvent | undefined,
	{
		driver,
		run,
		items,
		now
	}: {
		driver: TrackerHostLaunchPort;
		run: TrackerRunReceipt;
		items: TrackerItemReadRepository;
		now: number;
	},
	signal: AbortSignal
): Promise<TrackerDispatchEvent | undefined> {
	if (event?.type !== 'monitor' || run.cli !== 'codex' || !driver.readUsage) return event;
	const status = trackerItemStatus(items, run.item_id);
	if (
		event.session === 'live' &&
		(status === 'open' || status === 'in_progress') &&
		now <= (run.eta_at ?? run.queued_at + 8 * 60 * 60_000)
	)
		return event;
	try {
		const usage = await driver.readUsage(run, signal);
		return usage ? { ...event, usage } : event;
	} catch {
		signal.throwIfAborted();
		return event;
	}
}

export function trackerItemStatus(items: TrackerItemReadRepository, id: string): string | null {
	try {
		return items.getStored(id).status;
	} catch {
		return null;
	}
}
