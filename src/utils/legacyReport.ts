import type { LegacyRecord } from '../core/historyTypes';

export interface LegacyReport {
	/** Project the run belonged to, used only to decide whether it is this repository's. */
	project: { id: string; name: string; path: string };
	/** The run as it will be stored; media hashes are filled in when the files are read. */
	record: LegacyRecord;
}

export { legacyReport } from '../cli/program/legacy-import-service/legacyReport';
