import { test } from 'vitest';
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair } from 'jose';
import type { JWTPayload } from 'jose';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import {
	GOOGLE_ISSUERS,
	GoogleIdentityService
} from '../../src/lib/verification-evidence/server/auth/GoogleIdentityService';
import type {
	GoogleIdentity,
	GoogleIdentityOptions
} from '../../src/lib/verification-evidence/server/auth/GoogleIdentityService.types';
import type { Failure, Sign, Row, Case } from './hub.service.google-identity.test.types';

export const CLIENT_ID = 'hub-example.apps.googleusercontent.com';
const KID = 'hub-example-google-key';
export const ISSUED_NONCE = 'Vq3kT9xLw2Rz7Hc0dNm5pYe8sGa1uJf4oKi6tWb2Qr9';
const NOW = Date.parse('2026-11-16T09:00:00Z');
export const NOW_SECONDS = NOW / 1000;
export const DANA: GoogleIdentity = {
	actor: {
		id: 'google-110248495921238699583',
		email: 'dana.lee@gmail.com',
		name: 'Dana Lee',
		emailVerified: true
	},
	authoritative: true
};

/** An RS256 signer; its public key is published under KID, as Google publishes its keys. */
export async function signer() {
	const { privateKey, publicKey } = await generateKeyPair('RS256');
	const jwk = await exportJWK(publicKey);
	return {
		keys: createLocalJWKSet({ keys: [{ ...jwk, kid: KID, alg: 'RS256', use: 'sig' }] }),
		sign: (claims: JWTPayload, kid = KID) =>
			new SignJWT(claims).setProtectedHeader({ alg: 'RS256', kid }).sign(privateKey)
	};
}

/** Claims of a verified Gmail account; each row overrides only the claims it varies. */
export function googleClaims(overrides: JWTPayload = {}): JWTPayload {
	return {
		iss: GOOGLE_ISSUERS[0],
		aud: CLIENT_ID,
		sub: '110248495921238699583',
		nonce: ISSUED_NONCE,
		exp: NOW_SECONDS + 3600,
		email: 'dana.lee@gmail.com',
		email_verified: true,
		name: 'Dana Lee',
		...overrides
	};
}

export function serviceFor(keys: GoogleIdentityOptions['keys']): GoogleIdentityService {
	return new GoogleIdentityService({ clientId: CLIENT_ID, keys, now: () => NOW });
}

function failure(error: unknown): Failure {
	const reason = error instanceof Error ? error : new Error('non-Error rejection');
	return {
		name: reason.name,
		message: reason.message,
		code: 'code' in reason ? reason.code : null,
		status: 'status' in reason ? reason.status : null
	};
}

/** Verifies every row's credential against the nonce this server issued, in row order. */
export async function verifyRows(
	service: GoogleIdentityService,
	sign: Sign,
	rows: Row[]
): Promise<Case[]> {
	return Promise.all(
		rows.map(async ([name, claims, own = sign]) => {
			const credential = await own(claims);
			const input = { claims, nonce: ISSUED_NONCE };
			try {
				return { name, input, output: await service.verify(credential, ISSUED_NONCE) };
			} catch (error) {
				return { name, input, error: failure(error) };
			}
		})
	);
}

export function outcomesOf(cases: Case[]): unknown[] {
	return cases.map((item) => ('output' in item ? item.output : item.error));
}

export function recordCases(state: string, cases: Case[]): void {
	recordExampleCases(
		{
			unitId: 'hub.service.google-identity',
			symbol: 'verify',
			state,
			evidence: 'examples-cases',
			file: `${state}.json`
		},
		cases
	);
}

test('Marks only Gmail and Workspace identities authoritative', async () => {
	const { keys, sign } = await signer();
	const cases = await verifyRows(serviceFor(keys), sign, [
		[
			'Gmail address with a padded name and a mixed-case email',
			googleClaims({ email: 'Dana.Lee@Gmail.com', name: '  Dana Lee  ' })
		],
		[
			'Workspace account reached through the bare issuer host',
			googleClaims({
				iss: GOOGLE_ISSUERS[1],
				sub: '104558213907216483025',
				email: 'ops.team@acme-corp.com',
				hd: 'acme-corp.com',
				name: 'Ops Team'
			})
		],
		[
			'other domain with no name claim',
			googleClaims({
				sub: '117392046583102947561',
				email: 'priya.n@example.org',
				name: undefined
			})
		]
	]);
	expect(outcomesOf(cases)).toEqual([
		DANA,
		{
			actor: {
				id: 'google-104558213907216483025',
				email: 'ops.team@acme-corp.com',
				name: 'Ops Team',
				emailVerified: true
			},
			authoritative: true
		},
		{
			actor: {
				id: 'google-117392046583102947561',
				email: 'priya.n@example.org',
				name: 'priya.n',
				emailVerified: true
			},
			authoritative: false
		}
	]);
	recordCases('marks-only-gmail-and-workspace-identities-authoritative', cases);
});
