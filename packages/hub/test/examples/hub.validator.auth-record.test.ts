import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { AuthRecordValidator } from '../../src/validators/accounts-access/AuthRecordValidator';
import { AuthRecordCorruptError } from '../../src/validators/accounts-access/AuthRecordValidator.types';
import type { Validate, Case } from './hub.validator.auth-record.test.types';

const unitId = 'hub.validator.auth-record';
const validator = new AuthRecordValidator();
const corrupt = 'Hub auth record corrupt';
const actorId = '1f2e3d4c-5b6a-4789-9012-3456789abcde';
const actor = { id: actorId, email: 'alex@example.com', name: 'Alex Rivera', emailVerified: true };

/** Runs each example through the real validator, asserts what came back, and records the cases. */
function checkExamples(symbol: string, state: string, run: Validate, examples: Case[]) {
	const cases = examples.map(({ name, input }): Case => {
		try {
			return { name, input, output: run(input) };
		} catch (error) {
			expect(error).toBeInstanceOf(AuthRecordCorruptError);
			return { name, input, error: error instanceof Error ? error.message : String(error) };
		}
	});
	expect(cases).toEqual(examples);
	recordExampleCases(
		{ unitId, symbol, state, evidence: 'examples-cases', file: `${state}.json` },
		cases
	);
}

const challengeRow = {
	id_hash: 'c4e6e23f5c1d40c2a2d24c6678499c18e8e8e064',
	nonce: 'nQ3zP8kV2aY7mD4s',
	csrf_hash: '4b5f8cfc80f59ca3286fa65c',
	expires_at: 1893456000000
};
const challengeRecord = {
	idHash: 'c4e6e23f5c1d40c2a2d24c6678499c18e8e8e064',
	nonce: 'nQ3zP8kV2aY7mD4s',
	csrfHash: '4b5f8cfc80f59ca3286fa65c',
	expiresAt: 1893456000000
};

test('Copies a stored challenge row into a challenge record', () => {
	checkExamples(
		'challenge',
		'copies-a-stored-challenge-row-into-a-challenge-record',
		(input) => validator.challenge(input),
		[
			{ name: 'copies every column', input: challengeRow, output: challengeRecord },
			{ name: 'rejects an empty nonce', input: { ...challengeRow, nonce: '' }, error: corrupt },
			{ name: 'rejects a null row', input: null, error: corrupt }
		]
	);
});

const sessionRow = {
	id_hash: 'b83c9e6f1f47d4a2b9822d8c6487b128',
	kind: 'browser',
	parent_hash: null,
	actor_id: actorId,
	actor_email: 'alex@example.com',
	actor_name: 'Alex Rivera',
	resource: 'https://api.example.com',
	created_at: 1760000000000,
	expires_at: 1893456000000,
	revoked_at: null
};
const sessionRecord = {
	idHash: 'b83c9e6f1f47d4a2b9822d8c6487b128',
	kind: 'browser',
	parentHash: null,
	actor,
	resource: 'https://api.example.com',
	createdAt: 1760000000000,
	expiresAt: 1893456000000,
	revokedAt: null
};

test('Maps a session row and rejects an unknown session kind', () => {
	checkExamples(
		'session',
		'maps-a-session-row-and-rejects-an-unknown-session-kind',
		(input) => validator.session(input),
		[
			{ name: 'copies a browser session', input: sessionRow, output: sessionRecord },
			{
				name: 'nulls missing columns of a native session',
				input: { ...sessionRow, kind: 'native', parent_hash: undefined, revoked_at: undefined },
				output: { ...sessionRecord, kind: 'native' }
			},
			{ name: 'rejects an unknown kind', input: { ...sessionRow, kind: 'mobile' }, error: corrupt }
		]
	);
});

const emailProofRow = {
	id_hash: '994e3f05f7914bda8172388f2a3c660e',
	actor_id: actorId,
	actor_email: 'alex@example.com',
	actor_name: 'Alex Rivera',
	code_hash: 'd46f8e0c1a25b7d3f9046a2b8c51e790',
	code_expires_at: 1800000000000,
	attempts: 1,
	claimed: 0,
	expires_at: 1893456000000
};
const emailProofRecord = {
	idHash: '994e3f05f7914bda8172388f2a3c660e',
	actor,
	codeHash: 'd46f8e0c1a25b7d3f9046a2b8c51e790',
	codeExpiresAt: 1800000000000,
	attempts: 1,
	claimed: false,
	expiresAt: 1893456000000
};

test('Converts the claimed flag of an email proof to a boolean', () => {
	checkExamples(
		'emailProof',
		'converts-the-claimed-flag-of-an-email-proof-to-a-boolean',
		(input) => validator.emailProof(input),
		[
			{ name: 'copies an unclaimed proof', input: emailProofRow, output: emailProofRecord },
			{
				name: 'reads claimed 1 and cleared code columns as null',
				input: { ...emailProofRow, claimed: 1, code_hash: undefined, code_expires_at: undefined },
				output: { ...emailProofRecord, claimed: true, codeHash: null, codeExpiresAt: null }
			},
			{ name: 'rejects claimed value 2', input: { ...emailProofRow, claimed: 2 }, error: corrupt }
		]
	);
});

const grantRow = {
	actor_id: actorId,
	github_user_id: 58323114,
	login: 'alexrivera',
	token_cipher: 'cipher-v1:Q7mP3kN8',
	token_expires_at: null,
	refresh_cipher: null,
	refresh_expires_at: null,
	created_at: 1760000000000,
	expires_at: 1893456000000
};
const grantRecord = {
	actorId,
	githubUserId: 58323114,
	login: 'alexrivera',
	tokenCipher: 'cipher-v1:Q7mP3kN8',
	tokenExpiresAt: null,
	refreshCipher: null,
	refreshExpiresAt: null,
	createdAt: 1760000000000,
	expiresAt: 1893456000000
};
const liveRow = { generation: 4, revoked_at: null, refreshing_until: null, ...grantRow };
const liveRecord = { generation: 4, grant: grantRecord, refreshingUntil: null };

test('Reads a live grant state and a revoked tombstone', () => {
	checkExamples(
		'grantState',
		'reads-a-live-grant-state-and-a-revoked-tombstone',
		(input) => validator.grantState(input),
		[
			{ name: 'reads a live grant with its grant', input: liveRow, output: liveRecord },
			{
				name: 'reads a revoked row as a tombstone',
				input: { ...liveRow, generation: 5, revoked_at: 1761000000000 },
				output: { generation: 5, grant: null, refreshingUntil: null }
			},
			{ name: 'rejects an empty login', input: { ...liveRow, login: '' }, error: corrupt }
		]
	);
});

const exchangeRow = {
	id: '550e8400-e29b-41d4-a716-446655440000',
	challenge: 'native-challenge-01JBY3Q4K2M7',
	nonce_hash: '513f67eac6e4b2f97a1d2c3e4f506172',
	code_hash: 'b2a70c4d8e1f3956a0c3d7e9f1425b68',
	resource: 'https://api.example.com',
	audience: 'https://api.example.com',
	action: 'login',
	environment: 'production',
	origin: 'https://app.example.com',
	status: 'approved',
	subject: null,
	parent_hash: null,
	expires_at: 1893456000000
};
const exchangeRecord = {
	id: '550e8400-e29b-41d4-a716-446655440000',
	challenge: 'native-challenge-01JBY3Q4K2M7',
	nonceHash: '513f67eac6e4b2f97a1d2c3e4f506172',
	codeHash: 'b2a70c4d8e1f3956a0c3d7e9f1425b68',
	resource: 'https://api.example.com',
	audience: 'https://api.example.com',
	action: 'login',
	environment: 'production',
	origin: 'https://app.example.com',
	status: 'approved',
	subject: null,
	parentHash: null,
	expiresAt: 1893456000000
};

test('Accepts a native exchange and rejects unknown enum values', () => {
	checkExamples(
		'exchange',
		'accepts-a-native-exchange-and-rejects-unknown-enum-values',
		(input) => validator.exchange(input),
		[
			{ name: 'copies an approved exchange', input: exchangeRow, output: exchangeRecord },
			{
				name: 'rejects an unknown environment',
				input: { ...exchangeRow, environment: 'preview' },
				error: corrupt
			},
			{ name: 'rejects a bad status', input: { ...exchangeRow, status: 'expired' }, error: corrupt }
		]
	);
});
