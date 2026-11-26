// @harness-uid u_fwtzg2uaq6
import type { QaSlackMessage, QaThreadState } from '../../../core/agents-providers/qaSync.types';

export interface QaCandidate {
	thread: QaThreadState;
	parent: QaSlackMessage;
}
