import type { AttachedRecord } from '../../../../../src/services/history-status-service/attached-record-service/AttachedRecordService';
import type { EvidenceFile } from '../../../../../src/core/historyTypes';

export interface HubAttachedRecord extends Omit<AttachedRecord, 'files'> {
	/** Only record.json is retained; captures and logs are validated then discarded. */
	files: Map<string, Uint8Array>;
	/** Immutable hash, length, storage and blob identity of every successfully validated file. */
	facts: Map<string, Readonly<EvidenceFile & { blob: string }>>;
}
