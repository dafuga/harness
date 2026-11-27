// @harness-uid u_bl6xl2h4a3
import type { TrackerBackupOptions } from './TrackerBackupService.types';
import type {
	TrackerDispatchPolicy,
	TrackerDuePolicy
} from '../agents-providers/TrackerDispatcherService.types';
import type { TrackerDispatchRepositoryOptions } from '../../repositories/projects-sessions/TrackerDispatchRepository.types';
import type { TrackerDispatchSchedulerOptions } from './TrackerDispatchSchedulerService.types';
import type { TrackerSchemaAdapterConfig } from '../../adapters/projects-sessions/TrackerSchemaAdapter.types';
import type { TrackerNotificationSourceOptions } from '../../repositories/projects-sessions/TrackerNotificationSourceRepository.types';
import type { TrackerAdapterPollDependencies } from './TrackerAdapterPollService.types';
import type { TrackerOutgoingDraftServiceOptions } from './TrackerOutgoingDraftService.types';
import type { TrackerHubOptions, TrackerWireValue } from './TrackerHubSyncService.types';
import type { TrackerLocalApiOptions } from './TrackerLocalApiService.types';
import type { TrackerMachineSampler } from './TrackerMachineService.types';
import type { TrackerNotificationOptions } from './TrackerNotificationService.types';
import type { TrackerWebPushOptions } from './TrackerWebPushService.types';
import type { TrackerBoxJobRunner } from './TrackerRecurringService.types';
import type { TrackerSpokeLoopOptions } from './TrackerSpokeLoopService.types';
import type { TrackerHostEffects } from './tracker-native-runtime-service/nativeTrackerHostEffects.types';
import type { previewDueLaunch } from '../agents-providers/tracker-dispatcher-service/launchIntent';

export interface TrackerDuePreviewPolicy {
	timeZone: string;
	due(): TrackerDuePolicy;
	preview?(id: string): ReturnType<typeof previewDueLaunch>;
}

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
	'runs' | 'recurring' | 'jobs' | 'schedulePreview' | 'launchWait' | 'reject'
> {
	node: string;
	role: 'hub' | 'spoke';
	backupDirectory?: string;
	/** Set on a hub that takes its own daily backups. */
	backup?: TrackerBackupOptions;
	storage?: Omit<TrackerSchemaAdapterConfig, 'now'>;
	notification?: TrackerNativeNotificationOptions;
	/** Browser notifications for Daniel's open decisions; a hub node only. */
	webPush?: Pick<TrackerWebPushOptions, 'database' | 'fetch'>;
	adapter?: TrackerAdapterPollDependencies;
	hostEffects?: TrackerHostEffects;
	hostEffectsHeld?: boolean;
	recurring?: { jobs?: TrackerBoxJobRunner };
	automaticEnabled?(): boolean;
	/** Reads this computer's resources. Without it the node reports none. */
	machineSampler?: TrackerMachineSampler;
	dispatch?: Omit<TrackerDispatchSchedulerOptions, 'policy'> &
		Pick<TrackerDispatchRepositoryOptions, 'due' | 'sessions'> & {
			policy: Omit<TrackerDispatchPolicy, 'node' | 'now' | 'hub'>;
			telemetry?: {
				sample(): TrackerWireValue | undefined;
				onMachines?(machines: readonly unknown[]): void;
			};
		};
	outgoingProvider?: TrackerOutgoingDraftServiceOptions['provider'];
	syncResponder?: Omit<TrackerHubOptions, 'store'>;
	links?: readonly Omit<TrackerSpokeLoopOptions, 'store'>[];
}
