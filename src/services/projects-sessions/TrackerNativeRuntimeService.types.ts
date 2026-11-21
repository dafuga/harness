// @harness-uid u_bl6xl2h4a3
import type { TrackerDispatchPolicy } from '../agents-providers/TrackerDispatcherService.types';
import type { TrackerDispatchRepositoryOptions } from '../../repositories/projects-sessions/TrackerDispatchRepository.types';
import type { TrackerDispatchSchedulerOptions } from './TrackerDispatchSchedulerService.types';
import type { TrackerSchemaAdapterConfig } from '../../adapters/projects-sessions/TrackerSchemaAdapter.types';
import type { TrackerNotificationSourceOptions } from '../../repositories/projects-sessions/TrackerNotificationSourceRepository.types';
import type { TrackerAdapterPollDependencies } from './TrackerAdapterPollService.types';
import type { TrackerHubOptions } from './TrackerHubSyncService.types';
import type { TrackerLocalApiOptions } from './TrackerLocalApiService.types';
import type { TrackerNotificationOptions } from './TrackerNotificationService.types';
import type { TrackerRecurringJobRunner } from './TrackerRecurringService.types';
import type { TrackerSpokeLoopOptions } from './TrackerSpokeLoopService.types';
import type { TrackerHostEffects } from './tracker-native-runtime-service/nativeTrackerHostEffects.types';

export interface TrackerLegacyDestinationBindings {
	urls?: ReadonlyMap<string, string>;
	commands?: ReadonlyMap<string, string>;
}

export interface TrackerNativeNotificationOptions extends Omit<
	TrackerNotificationOptions,
	'source' | 'role' | 'now' | 'queue'
> {
	queue?: TrackerNotificationOptions['queue'];
	resolveDestination?: TrackerNotificationSourceOptions['resolveDestination'];
	legacyDestinations?: TrackerLegacyDestinationBindings;
}

export interface TrackerNativeRuntimeOptions extends Omit<
	TrackerLocalApiOptions,
	'runs' | 'recurring'
> {
	node: string;
	role: 'hub' | 'spoke';
	storage?: Omit<TrackerSchemaAdapterConfig, 'now'>;
	notification?: TrackerNativeNotificationOptions;
	adapter?: TrackerAdapterPollDependencies;
	hostEffects?: TrackerHostEffects;
	hostEffectsHeld?: boolean;
	recurring?: { jobs?: TrackerRecurringJobRunner };
	dispatch?: Omit<TrackerDispatchSchedulerOptions, 'policy'> &
		Pick<TrackerDispatchRepositoryOptions, 'due' | 'sessions'> & {
			policy: Omit<TrackerDispatchPolicy, 'node' | 'now' | 'hub'>;
			telemetry?: { sample(): unknown; onMachines?(machines: readonly unknown[]): void };
		};
	syncResponder?: Omit<TrackerHubOptions, 'store'>;
	links?: readonly Omit<TrackerSpokeLoopOptions, 'store'>[];
}
