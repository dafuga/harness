// @harness-uid u_g7kdpz7bel
import type { TrackerItemValue } from '../../../utils/projects-sessions/normalizeTrackerItemFields.types';
import { isTrackerCosMessage } from '../../../utils/projects-sessions/isTrackerPing';
import { recordWatchdogAlert } from '../tracker-native-runtime-service/trackerHostWatchdogAlerts';
import type { TrackerPersistenceService } from '../TrackerPersistenceService';

/** Put a flag addressed to Chief of Staff on their channel. The item already holds it as a note. */
export function recordCosFlag(
	store: TrackerPersistenceService,
	flag: { itemId: string; action: string | undefined; question: TrackerItemValue },
	now: number
): void {
	const { itemId, action, question } = flag;
	if (action !== 'flag' || typeof question !== 'string' || !isTrackerCosMessage(question)) return;
	recordWatchdogAlert(
		store,
		{ itemId, kind: 'cos-message', reason: question, identity: question, localOnly: true },
		now
	);
}
