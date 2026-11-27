// @harness-uid u_ergeyiyuka
import type { HubRecordStatusService } from '../../services/verification-evidence/hub-evidence-service/HubRecordStatusService';
import type { HubAttachedRecord } from './hubAttachedRecord.types';

export async function hubEvidenceOrigin(
	history: HubRecordStatusService,
	id: string
): Promise<HubAttachedRecord | undefined> {
	const line = (await history.verifications()).find((item) => item.record === id);
	const loaded = line ? await history.attached.load(line.evidence) : undefined;
	return loaded?.record?.id === id ? loaded : undefined;
}

export { hubEvidenceViews } from './hub-evidence-revision/hubEvidenceViews';
