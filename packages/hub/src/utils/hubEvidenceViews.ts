import type { HubRecordStatusService } from '../services/hub-evidence-service/HubRecordStatusService';

export async function hubEvidenceOrigin(history: HubRecordStatusService, id: string) {
	const line = (await history.verifications()).find((item) => item.record === id);
	const loaded = line ? await history.attached.load(line.evidence) : undefined;
	return loaded?.record?.id === id ? loaded : undefined;
}

export { hubEvidenceViews } from './hub-evidence-revision/hubEvidenceViews';
