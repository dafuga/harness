// @harness-uid u_pwotvhqpjv
import type { LiveChunk } from './SealedLive.types';
import type { SealedSession } from './sealedSessions.types';

export interface SealedHomeCallbacks {
	sessions: (sessions: SealedSession[]) => void;
	output: (stream: string, chunks: LiveChunk[]) => void;
}
