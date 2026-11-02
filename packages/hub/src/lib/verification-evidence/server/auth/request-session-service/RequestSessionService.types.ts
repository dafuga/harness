// @harness-uid u_z5ens2b66y
import type { SessionRepository } from '../../../../../repositories/projects-sessions/SessionRepository';

export interface RequestSessionOptions {
	sessions: SessionRepository;
	origin: string;
}
