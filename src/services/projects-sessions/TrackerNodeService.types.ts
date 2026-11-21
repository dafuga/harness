// @harness-uid u_gvqtr5mdwv
import type { SqliteDatabase } from '../../core/development-tooling/sqliteTypes';
import type { TrackerNativeRuntimeService } from './TrackerNativeRuntimeService';
import type { TrackerSupervisorService } from './TrackerSupervisorService';

export interface TrackerNodeOwner {
	readonly node: string;
	readonly port: number;
	readonly syncPort?: number;
	readonly pid: number;
	readonly checkpoint: string;
	readonly workers: Promise<void>;
	close(): Promise<void>;
}

export interface TrackerNodeOwnership {
	readonly lifetime: AbortSignal;
	readonly listeners: { close(): Promise<void> }[];
	database?: SqliteDatabase;
	runtime?: TrackerNativeRuntimeService;
	supervisor?: TrackerSupervisorService;
	workers?: Promise<void>;
	releaseSocket?: () => Promise<void>;
	close(checkRollback: boolean): Promise<void>;
}
