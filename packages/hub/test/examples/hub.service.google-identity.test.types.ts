import type { JWTPayload } from 'jose';
import type { GoogleIdentity } from '../../src/lib/verification-evidence/server/auth/GoogleIdentityService.types';

export type Sign = (claims: JWTPayload) => Promise<string>;

export type Row = [name: string, claims: JWTPayload, sign?: Sign];

export interface Failure {
	name: string;
	message: string;
	code: unknown;
	status: unknown;
}

export type Outcome = { output: GoogleIdentity } | { error: Failure };

export type Case = { name: string; input: { claims: JWTPayload; nonce: string } } & Outcome;
