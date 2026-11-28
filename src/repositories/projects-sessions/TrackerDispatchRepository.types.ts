// @harness-uid u_ksy76trvsj
import type {
	TrackerDispatchPolicy,
	TrackerDuePolicy,
	TrackerRunReceipt
} from '../../services/agents-providers/TrackerDispatcherService.types';
import type { TrackerItemRow } from './TrackerItemReadRepository.types';

export interface TrackerDispatchRepositoryOptions {
	policy?: Pick<TrackerDispatchPolicy, 'resolveHost' | 'maxRunMinutes'>;
	due?(): TrackerDuePolicy;
	sessions?(itemId: string): { openSession?: boolean; activeSessionKeys?: readonly string[] };
	now?: () => number;
}

export interface TrackerDispatchCandidate {
	id: string;
	auto: string | null;
	launch_source: string | null;
	launch_target: string | null;
	priority: string | null;
}

export type TrackerDispatchRow = TrackerItemRow & {
	dispatch_source: TrackerRunReceipt['launch_source'];
	brief?: string | null;
};

export type TrackerStoredDispatchRun = Omit<
	TrackerRunReceipt,
	'pinned' | 'revision' | 'launch_source' | 'host_session_id'
> & {
	pinned: number;
	reservation?: string | null;
};

export interface TrackerRunReservation {
	signature: string;
	revision: number;
	launch_source: TrackerRunReceipt['launch_source'];
	dispatch_at?: number;
	verificationFor?: string;
	hostSessionId?: string;
}
