import type { EvidenceFile } from '../../../../../src/core/historyTypes';
import type { AttachedRecord } from '../../../../../src/services/history-status-service/attached-record-service/AttachedRecordService';

export interface HubAttachedRecord extends Omit<AttachedRecord, 'files'> {
	/** Only record.json is retained; captures and logs are validated then discarded. */
	files: Map<string, Uint8Array>;
	/** Immutable hash, length, storage and blob identity of every successfully validated file. */
	facts: Map<string, Readonly<EvidenceFile & { blob: string }>>;
}

export function hubRecordJson(bytes: Uint8Array): unknown {
	try {
		return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
	} catch {
		return undefined;
	}
}

export { hubAttachedRecord } from '../../services/verification-evidence/hub-evidence-service/hub-attached-service/hubAttachedRecord';
