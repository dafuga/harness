// @harness-uid u_pwotvhqpjv
import type { SealedSession } from './sealedSessions.types';

export interface SealedHomeCallbacks {
	sessions: (sessions: SealedSession[]) => void;
	output: (stream: string, text: string) => void;
}
