// @harness-uid u_bl6xl2h4a3
import type { TrackerSchemaAdapterConfig } from '../../adapters/projects-sessions/TrackerSchemaAdapter.types';
import type { TrackerNotificationSourceOptions } from '../../repositories/projects-sessions/TrackerNotificationSourceRepository.types';
import type { TrackerAdapterPollDependencies } from './TrackerAdapterPollService.types';
import type { TrackerHubOptions } from './TrackerHubSyncService.types';
import type { TrackerLocalApiOptions } from './TrackerLocalApiService.types';
import type { TrackerNotificationOptions } from './TrackerNotificationService.types';
import type { TrackerSpokeLoopOptions } from './TrackerSpokeLoopService.types';

export interface TrackerNativeNotificationOptions extends Omit<
	TrackerNotificationOptions,
	'source' | 'role' | 'now'
> {
	resolveDestination: TrackerNotificationSourceOptions['resolveDestination'];
}

export interface TrackerNativeRuntimeOptions extends Omit<TrackerLocalApiOptions, 'runs'> {
	node: string;
	role: 'hub' | 'spoke';
	storage?: Omit<TrackerSchemaAdapterConfig, 'now'>;
	notification?: TrackerNativeNotificationOptions;
	adapter?: TrackerAdapterPollDependencies;
	syncResponder?: Omit<TrackerHubOptions, 'store'>;
	links?: readonly Omit<TrackerSpokeLoopOptions, 'store'>[];
}
