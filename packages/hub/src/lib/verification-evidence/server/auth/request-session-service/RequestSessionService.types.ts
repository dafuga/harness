import type { SessionRepository } from '../../../../../repositories/projects-sessions/SessionRepository';

export interface RequestSessionOptions {
	sessions: SessionRepository;
	origin: string;
}
