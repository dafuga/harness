import type { MemoryAuthStore } from './memoryAuthStore';
import type { AuthSecrets } from '../../src/utils/authSecrets';
import type { SessionRepository } from '../../src/repositories/projects-sessions/SessionRepository';

export interface AuthFixture {
	store: MemoryAuthStore;
	secrets: AuthSecrets;
	sessions: SessionRepository;
	now: () => number;
	advance(milliseconds: number): void;
}
