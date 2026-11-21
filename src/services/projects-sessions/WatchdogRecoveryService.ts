// @harness-uid u_5lrhbf453w
import type {
	RecoveryDecision,
	RecoverySnapshot,
	ResumeDecision,
	ResumeSnapshot
} from './WatchdogRecoveryService.types';

export class WatchdogRecoveryService {
	plan(_input: RecoverySnapshot): RecoveryDecision | null {
		return null;
	}
	resume(_input: ResumeSnapshot): ResumeDecision | null {
		return null;
	}
}
