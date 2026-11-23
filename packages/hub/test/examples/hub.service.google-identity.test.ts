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

const CLIENT_ID = 'hub-example.apps.googleusercontent.com';
const KID = 'hub-example-google-key';
const ISSUED_NONCE = 'Vq3kT9xLw2Rz7Hc0dNm5pYe8sGa1uJf4oKi6tWb2Qr9';
const NOW = Date.parse('2026-11-16T09:00:00Z');
const NOW_SECONDS = NOW / 1000;
const DANA: GoogleIdentity = {
	actor: {
		id: 'google-110248495921238699583',
		email: 'dana.lee@gmail.com',
		name: 'Dana Lee',
		emailVerified: true
	},
	authoritative: true
};
const REJECTED = {
	name: 'AuthFailure',
	message: 'Hub auth credential-invalid',
	code: 'credential-invalid',
	status: 401
};

type Sign = (claims: JWTPayload) => Promise<string>;
type Row = [name: string, claims: JWTPayload, sign?: Sign];
interface Failure {
	name: string;
	message: string;
	code: unknown;
	status: unknown;
}
type Outcome = { output: GoogleIdentity } | { error: Failure };
type Case = { name: string; input: { claims: JWTPayload; nonce: string } } & Outcome;

/** An RS256 signer; its public key is published under KID, as Google publishes its keys. */
async function signer() {
	const { privateKey, publicKey } = await generateKeyPair('RS256');
	const jwk = await exportJWK(publicKey);
	return {
		keys: createLocalJWKSet({ keys: [{ ...jwk, kid: KID, alg: 'RS256', use: 'sig' }] }),
		sign: (claims: JWTPayload, kid = KID) =>
			new SignJWT(claims).setProtectedHeader({ alg: 'RS256', kid }).sign(privateKey)
	};
}

/** Claims of a verified Gmail account; each row overrides only the claims it varies. */
function googleClaims(overrides: JWTPayload = {}): JWTPayload {
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

function serviceFor(keys: GoogleIdentityOptions['keys']): GoogleIdentityService {
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
async function verifyRows(
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

function outcomesOf(cases: Case[]): unknown[] {
	return cases.map((item) => ('output' in item ? item.output : item.error));
}

function recordCases(state: string, cases: Case[]): void {
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

test('Rejects a credential with an untrusted signature', async () => {
	const { keys, sign } = await signer();
	const forger = await signer();
	const cases = await verifyRows(serviceFor(keys), sign, [
		['signed by a key outside the published set', googleClaims(), forger.sign],
		[
			'signed under a key id that Google does not publish',
			googleClaims(),
			(claims) => sign(claims, 'retired-key')
		]
	]);
	expect(outcomesOf(cases)).toEqual([REJECTED, REJECTED]);
	recordCases('rejects-a-credential-with-an-untrusted-signature', cases);
});

test('Applies a 10 second tolerance to credential expiry', async () => {
	const { keys, sign } = await signer();
	const cases = await verifyRows(serviceFor(keys), sign, [
		['expired 5 seconds ago, inside the tolerance', googleClaims({ exp: NOW_SECONDS - 5 })],
		['expired 30 seconds ago, outside the tolerance', googleClaims({ exp: NOW_SECONDS - 30 })]
	]);
	expect(outcomesOf(cases)).toEqual([DANA, REJECTED]);
	recordCases('applies-a-10-second-tolerance-to-credential-expiry', cases);
});

test('Rejects a credential whose nonce does not match', async () => {
	const { keys, sign } = await signer();
	const cases = await verifyRows(serviceFor(keys), sign, [
		[
			'nonce differing from the issued one in one character',
			googleClaims({ nonce: ISSUED_NONCE.replace('V', 'W') })
		],
		['nonce cut short', googleClaims({ nonce: ISSUED_NONCE.slice(0, 20) })]
	]);
	expect(outcomesOf(cases)).toEqual([REJECTED, REJECTED]);
	recordCases('rejects-a-credential-whose-nonce-does-not-match', cases);
});

test('Rejects a credential addressed to another client', async () => {
	const { keys, sign } = await signer();
	const other = 'other-client.apps.googleusercontent.com';
	const cases = await verifyRows(serviceFor(keys), sign, [
		['audience of another client', googleClaims({ aud: other })],
		['authorized party of another client', googleClaims({ azp: other })],
		['audience list that also names this client', googleClaims({ aud: [CLIENT_ID, other] })]
	]);
	expect(outcomesOf(cases)).toEqual([REJECTED, REJECTED, REJECTED]);
	recordCases('rejects-a-credential-addressed-to-another-client', cases);
});

test('Rejects a credential whose email is not verified', async () => {
	const { keys, sign } = await signer();
	const cases = await verifyRows(serviceFor(keys), sign, [
		['email_verified is false', googleClaims({ email_verified: false })],
		['email_verified sent as the string true', googleClaims({ email_verified: 'true' })],
		['no email claim', googleClaims({ email: undefined })]
	]);
	expect(outcomesOf(cases)).toEqual([REJECTED, REJECTED, REJECTED]);
	recordCases('rejects-a-credential-whose-email-is-not-verified', cases);
});
