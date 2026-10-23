import type { SecureVectors } from './vectors.types';
import { readFileSync } from 'node:fs';
/** Frozen. Written once by scripts/secure-vectors.ts with node:crypto, never by the code under test. */
export const vectors = JSON.parse(
	readFileSync(new URL('./secure-vectors.json', import.meta.url), 'utf8')
) as SecureVectors;

export type { VectorPacket, SecureVectors } from './vectors.types';
