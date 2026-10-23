import type { AuthStore } from '../../src/models/HubAuthStore.types';

export type Expiring = { expiresAt: number };

export type Rows<T> = Map<string, T>;

export interface MemoryAuthStore extends AuthStore {
	/** Every stored row as text, for asserting that no secret is kept in the clear. */
	dump(): string;
	count(): number;
}
