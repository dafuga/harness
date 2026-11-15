// @harness-uid u_zhz7hjx43x
import type {
	Capture,
	VerificationRecord
} from '../../../core/verification-evidence/verificationTypes';
import type { PinnedHistory } from '../history-status-service/HistoryStatusService.types';

export interface ReadFrameCapture {
	capture: Capture;
	bytes: Buffer;
}

export interface SelectedFrameCapture {
	capture: Capture;
	record: VerificationRecord;
	pinned: PinnedHistory;
}
