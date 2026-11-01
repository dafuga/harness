import type { ThrownValue } from './errorMessage.types';

/** @pure Convert a thrown value to its readable message without changing its text. */
export function errorMessage(cause: ThrownValue): string {
	return cause instanceof Error ? cause.message : String(cause);
}
