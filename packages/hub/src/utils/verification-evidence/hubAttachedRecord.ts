export function hubRecordJson(bytes: Uint8Array): unknown {
	try {
		return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
	} catch {
		return undefined;
	}
}

export { hubAttachedRecord } from '../../services/verification-evidence/hub-evidence-service/hub-attached-service/hubAttachedRecord';

export type { HubAttachedRecord } from './hubAttachedRecord.types';
