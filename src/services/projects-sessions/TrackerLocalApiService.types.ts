// @harness-uid u_g7kdpz7bel
import type { TrackerDispatchResult } from '../agents-providers/TrackerDispatcherService.types';
import type { TrackerItemReadRepository } from '../../repositories/projects-sessions/TrackerItemReadRepository';
import type { TrackerPersistenceService } from './TrackerPersistenceService';
import type { TrackerMachineService } from './TrackerMachineService';
import type { TrackerBoxJobAdmin } from './tracker-recurring-service/trackerBoxJobAdmin.types';
import type { TrackerPhoneReplicaService } from './TrackerPhoneReplicaService';
import type { PhoneReplicaWriteGrant } from './tracker-phone-replica-service/PhoneReplicaWriteService.types';
import type { TrackerRunReadRepository } from '../../repositories/projects-sessions/TrackerRunReadRepository';
import type { TrackerItem } from '../../repositories/projects-sessions/TrackerItemReadRepository.types';
import type { TrackerLadderConfig } from '../../utils/agents-providers/parseTrackerModelSpec.types';
import type { TrackerItemInput } from '../../utils/projects-sessions/normalizeTrackerItemFields.types';
import type {
	TrackerItemMutationContext,
	TrackerItemSnapshot
} from '../../utils/projects-sessions/planTrackerItemMutation.types';

export interface TrackerLocalApiOptions {
	/** Record a rejected completion through the launcher that owns its run. */
	reject?(itemId: string, reason: string): Promise<TrackerDispatchResult>;
	now?: () => number;
	phoneReplica?: TrackerPhoneReplicaService;
	phoneWrite?: PhoneReplicaWriteGrant;
	manualLaunch?: boolean;
	timeZone?: string;
	runs?: TrackerRunReadRepository;
	machines?: TrackerMachineService;
	schedulePreview?(item: TrackerItem): string | null;
	/** Why a requested launch has no run yet. */
	/** The end of the operator's Claude preference while it is on, for `tracker pick`. */
	claudePreferredUntil?(): string | undefined;
	launchWait?(item: TrackerItem): { computer: string; reason: string };
	recurring?: {
		role: 'hub' | 'spoke';
		history?: (id: string, limit: number) => unknown;
	};
	/** Absent unless this node is a hub that runs box jobs. */
	jobs?: TrackerBoxJobAdmin;
	ladderConfig?: TrackerLadderConfig;
	validateModel?: TrackerItemMutationContext['validateModel'];
	planLaunch?(
		fields: TrackerItemInput,
		current: TrackerItemSnapshot | undefined,
		source: 'manual' | 'automatic'
	): TrackerItemInput;
}

export interface TrackerLocalApiDependencies {
	store: TrackerPersistenceService;
	items: TrackerItemReadRepository;
	options: TrackerLocalApiOptions;
}
