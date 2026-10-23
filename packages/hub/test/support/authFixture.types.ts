import type { MemoryAuthStore } from './memoryAuthStore';
import type { AuthSecrets } from '../../src/utils/authSecrets';
import type { SessionRepository } from '../../src/repositories/SessionRepository';

export interface AuthFixture {
	store: MemoryAuthStore;
	secrets: AuthSecrets;
	sessions: SessionRepository;
	now: () => number;
	advance(milliseconds: number): void;
}
