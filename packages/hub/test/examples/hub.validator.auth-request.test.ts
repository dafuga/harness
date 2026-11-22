import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { AuthRequestValidator } from '../../src/validators/accounts-access/AuthRequestValidator';
import type { Body } from '../../src/validators/accounts-access/AuthRequestValidator.types';

const UNIT_ID = 'hub.validator.auth-request';
const validator = new AuthRequestValidator();

type Failure = { name: string; message: string };
type Cases = Parameters<typeof recordExampleCases>[1];

const CREDENTIAL =
	'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL2FjY291bnRzLmdvb2dsZS5jb20iLCJzdWIiOiIxMDQ1ODMyMzQ1NjI5MDEyMzQ1NiJ9.Yq3Vx8Lr0TmWc2Ng5Hd7Ke1Pb9Zu4Js6Fo-RtEi_wAqM2sXhT8dLnGv0KbE';
const CSRF = 'Ht8Wz2KqR5vN0bYcLm3Jd7TxPe9Ag1SuZi4Qo6FkEw-';
const START = {
	challenge: 'hR4pK8sLw1Xc7Nq0Vd3Tg6Ym9Jb2Fa5ZeUoCi8WnEua',
	nonce: 'k3Vq9Lz0Rw8XbTn2Ys6Jm1Ge7Hp4UdQ5',
	resource: 'projects'
};
const HANDOFF = 'V8kq2TzR7mWnXa4Lc9HjEbYd1Pg6Ufs0QoZ3iNtBxAe';
const EXCHANGE = {
	handoffId: HANDOFF,
	verifier: 'Tq7Zr2Wv9Kx4Lm0Ne8Ua3Pb6Cj1Fh5Ys-Gd_Ri0OtQz',
	nonce: 'k3Vq9Lz0Rw8XbTn2Ys6Jm1Ge7Hp4UdQ5',
	resource: 'projects'
};
const STATE = 'Qm3Lz9TcV0pRk8sXwY2hN6dJfA1gE4uB7iO5tS-xHcM';

/** Runs the call and returns the thrown error as plain values. */
function failureOf(run: () => unknown): Failure {
	let caught: unknown;
	try {
		run();
	} catch (error) {
		caught = error;
	}
	expect(caught).toBeInstanceOf(Error);
	const actual = caught as Error;
	expect(actual.message).toBe('Hub auth invalid-request');
	return { name: actual.name, message: actual.message };
}

function callbackUrl(query: string): URL {
	return new URL(`https://example.test/api/github/callback?${query}`);
}

function record(symbol: string, state: string, cases: Cases): void {
	recordExampleCases(
		{ unitId: UNIT_ID, symbol, state, evidence: 'examples-cases', file: `${state}.json` },
		cases
	);
}

test('Types Google sign-in bodies and drops unknown keys', () => {
	const body: Body = { credential: CREDENTIAL, csrf: CSRF, extra: 'dropped' };
	const output = validator.google(body);
	expect(output).toEqual({ credential: CREDENTIAL, csrf: CSRF });
	const missing = failureOf(() => validator.google({ credential: CREDENTIAL }));
	expect(missing.message).toBe('Hub auth invalid-request');
	record('google', 'types-google-sign-in-bodies-and-drops-unknown-keys', [
		{ name: 'keeps credential and csrf, drops the extra key', input: body, output },
		{ name: 'rejects a missing csrf', input: { credential: CREDENTIAL }, error: missing }
	]);
});

test('Types native start bodies and rejects a short challenge', () => {
	const output = validator.nativeStart(START);
	expect(output).toEqual(START);
	const shortInput = { ...START, challenge: START.challenge.slice(0, 42) };
	const short = failureOf(() => validator.nativeStart(shortInput));
	expect(short.message).toBe('Hub auth invalid-request');
	record('nativeStart', 'types-native-start-bodies-and-rejects-a-short-challenge', [
		{ name: 'accepts a 43-character S256 challenge with projects', input: START, output },
		{ name: 'rejects a 42-character challenge', input: shortInput, error: short }
	]);
});

test('Normalizes a typed approval code and rejects a short one', () => {
	const dashed = { handoffId: HANDOFF, userCode: 'KQ7M-2TPW' };
	const spaced = { handoffId: HANDOFF, userCode: 'kq7m 2tpw' };
	const outputDashed = validator.nativeApprove(dashed);
	const outputSpaced = validator.nativeApprove(spaced);
	expect(outputDashed).toEqual({ handoffId: HANDOFF, userCode: 'KQ7M2TPW' });
	expect(outputSpaced).toEqual(outputDashed);
	const shortInput = { handoffId: HANDOFF, userCode: 'KQ7M-2T' };
	const short = failureOf(() => validator.nativeApprove(shortInput));
	expect(short.message).toBe('Hub auth invalid-request');
	record('nativeApprove', 'normalizes-a-typed-approval-code-and-rejects-a-short-one', [
		{ name: 'dashes are dropped and case is folded', input: dashed, output: outputDashed },
		{ name: 'spaces and lower case are normalized', input: spaced, output: outputSpaced },
		{ name: 'rejects a code of 7 characters', input: shortInput, error: short }
	]);
});

test('Types native exchange and poll bodies', () => {
	const exchangeOutput = validator.nativeExchange(EXCHANGE);
	expect(exchangeOutput).toEqual(EXCHANGE);
	const pollInput = { handoffId: HANDOFF, extra: 1 };
	const pollOutput = validator.nativePoll(pollInput);
	expect(pollOutput).toEqual({ handoffId: HANDOFF });
	const missingInput = { verifier: EXCHANGE.verifier };
	const missing = failureOf(() => validator.nativePoll(missingInput));
	expect(missing.message).toBe('Hub auth invalid-request');
	record('nativeExchange', 'types-native-exchange-and-poll-bodies', [
		{ name: 'nativeExchange: keeps the four fields as sent', input: EXCHANGE, output: exchangeOutput },
		{ name: 'nativePoll: keeps only handoffId', input: pollInput, output: pollOutput },
		{ name: 'nativePoll: rejects a missing handoffId', input: missingInput, error: missing }
	]);
});

test('Returns GitHub callback code and state or null', () => {
	const okUrl = callbackUrl(`code=3f9c1a7e5b2d4c8f0a6e&state=${STATE}`);
	const output = validator.githubCallback(okUrl);
	expect(output).toEqual({ code: '3f9c1a7e5b2d4c8f0a6e', state: STATE });
	const refusalUrl = callbackUrl(`error=access_denied&state=${STATE}`);
	const refusal = validator.githubCallback(refusalUrl);
	expect(refusal).toBeNull();
	record('githubCallback', 'returns-github-callback-code-and-state-or-null', [
		{ name: 'returns code and state from the query', input: okUrl.search, output },
		{ name: 'returns null when GitHub reports a refusal', input: refusalUrl.search, output: refusal }
	]);
});

test('Accepts typed email codes and rejects seven digits', () => {
	const plain: Body = { code: '04829137' };
	const spaced: Body = { code: '0482 9137' };
	const dashed: Body = { code: '0482-9137' };
	const outputs = [plain, spaced, dashed].map((body) => validator.emailCode(body));
	expect(outputs).toEqual(['04829137', '04829137', '04829137']);
	const shortInput: Body = { code: '0482913' };
	const short = failureOf(() => validator.emailCode(shortInput));
	expect(short.message).toBe('Hub auth invalid-request');
	record('emailCode', 'accepts-typed-email-codes-and-rejects-seven-digits', [
		{ name: 'keeps leading zeros', input: plain, output: outputs[0] },
		{ name: 'removes a typed space', input: spaced, output: outputs[1] },
		{ name: 'removes a typed dash', input: dashed, output: outputs[2] },
		{ name: 'rejects seven digits', input: shortInput, error: short }
	]);
});
