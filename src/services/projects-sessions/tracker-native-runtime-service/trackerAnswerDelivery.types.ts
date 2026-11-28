// @harness-uid u_bl6xl2h4a3
import type { TrackerListedRun } from '../../../repositories/projects-sessions/TrackerRunReadRepository.types';

export interface PendingTrackerAnswer {
	id: string;
	answeredAt: string;
	generation: string;
	choice: string | null;
}

export interface TrackerAnswerAttempt {
	answer: PendingTrackerAnswer;
	run: TrackerListedRun;
	at: number;
}
