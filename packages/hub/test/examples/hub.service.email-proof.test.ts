import { test } from 'vitest';
import type { Actor } from 'collaboration';
import type { AuthFailure } from '../../src/utils/accounts-access/authFail';
import * as proof from '../../src/services/verification-evidence/email-proof-service/EmailProofService';
import * as repository from '../../src/repositories/projects-sessions/SessionRepository';
import { expect } from '../../../../test/verificationExpect';
import type { Fixture } from './hub.service.email-proof.test.types';
import { fixture, riley, record, sam } from './hub.service.email-proof.cases';
export { fixture } from './hub.service.email-proof.cases';

const SENT_UNTIL = '2026-11-16T12:50:00.000Z';
const LAPSE = '2026-12-16T12:40:00.000Z';
const OPENED = 'cookie from open()';
const UNKNOWN_COOKIE = 'h7Lk2QpW9xT4vRz0bNcE8uJ3sYaG6dMfX1oIqVtZ5rA';

/** Opens a pending proof and mails its first code. The caller keeps the returned cookie. */
async function mailedProof(f: Fixture, person: Actor): Promise<string> {
	const { cookie } = await f.service.open(person);
	await f.service.start(cookie);
	return cookie;
}
const lastCode = (f: Fixture) => f.mailbox.sent.at(-1)?.code ?? '';
const wrongCode = (code: string) => (code === '00000000' ? '11111111' : '00000000');

/** The refusal a call raised: its name, stable code, status and message. */
async function refusal(call: Promise<unknown>) {
	const caught = await call.then(() => null).catch((error: unknown) => error as AuthFailure);
	if (!caught) throw new Error('The call was expected to be refused.');
	const { name, code, status, message } = caught;
	return { name, code, status, message };
}

test('status reports a sent code until the proof expires', async () => {
	const f = fixture();
	const { cookie, status: initial } = await f.service.open(riley);
	const pending = await f.service.status(cookie);
	await f.service.start(cookie);
	const sent = await f.service.status(cookie);
	f.move(proof.PENDING_TTL);
	const expired = await f.service.status(cookie);
	const unknown = await f.service.status(UNKNOWN_COOKIE);
	expect(pending).toEqual(initial);
	expect(sent).toEqual({ email: riley.email, sent: true, expiresAt: SENT_UNTIL });
	expect(expired).toBeNull();
	expect(unknown).toBeNull();
	record('status', 'status-reports-a-sent-code-until-the-proof-expires', [
		{ name: 'riley before any code is mailed', input: { cookie: OPENED }, output: pending },
		{ name: 'riley after the first code is mailed', input: { cookie: OPENED }, output: sent },
		{ name: 'riley at the window end', input: { cookie: OPENED, at: SENT_UNTIL }, output: expired },
		{ name: 'an unknown cookie', input: { cookie: UNKNOWN_COOKIE }, output: unknown }
	]);
});

test('start mails one code and refuses a repeat within a minute', async () => {
	const f = fixture();
	const { cookie } = await f.service.open(riley);
	const sent = await f.service.start(cookie);
	const [message] = f.mailbox.sent;
	const repeat = await refusal(f.service.start(cookie));
	f.mailbox.failing = true;
	const samCookie = (await f.service.open(sam)).cookie;
	const failed = await refusal(f.service.start(samCookie));
	const unsent = await f.service.status(samCookie);
	const unset = new proof.EmailProofService({ ...f.options, delivery: null });
	const disabled = await refusal(unset.start(cookie));
	expect(sent).toEqual({ email: riley.email, sent: true, expiresAt: SENT_UNTIL });
	expect(message?.email).toBe(riley.email);
	expect(message?.expiresAt).toBe(SENT_UNTIL);
	expect(/^\d{8}$/.test(message?.code ?? '')).toBe(true);
	expect(repeat).toMatchObject({ code: 'email-rate-limited', status: 429 });
	expect(failed).toMatchObject({ code: 'email-delivery-failed', status: 502 });
	expect(failed.message).toBe('Hub auth email-delivery-failed');
	expect(unsent).toEqual({ email: sam.email, sent: false, expiresAt: null });
	expect(f.mailbox.sent.length).toBe(1);
	expect(disabled).toMatchObject({ code: 'email-delivery-disabled', status: 503 });
	const mailed = { status: sent, codeCharacters: message?.code.length };
	record('start', 'start-mails-one-code-and-refuses-a-repeat-within-a-minute', [
		{ name: 'riley requests a first code', input: { cookie: OPENED }, output: mailed },
		{ name: 'riley asks again in the same minute', input: { cookie: OPENED }, error: repeat },
		{ name: 'sam, provider fails', input: { actor: sam, providerFails: true }, error: failed },
		{ name: 'riley, with no delivery', input: { cookie: OPENED, delivery: null }, error: disabled }
	]);
});

test('verify accepts only the newest code and issues a session', async () => {
	const f = fixture();
	const cookie = await mailedProof(f, riley);
	const older = lastCode(f);
	f.move(proof.SEND_INTERVAL);
	await f.service.start(cookie);
	const stale = await refusal(f.service.verify(cookie, older));
	const issued = await f.service.verify(cookie, lastCode(f));
	const parentHash = await f.secrets.hash('email-proof', cookie);
	expect(stale).toMatchObject({ code: 'email-code-invalid', status: 400 });
	expect(/^[\w-]{43}$/.test(issued.credential)).toBe(true);
	expect(issued.record).toMatchObject({ kind: 'browser', actor: riley, parentHash });
	expect(issued.record.expiresAt - issued.record.createdAt).toBe(repository.BROWSER_TTL);
	expect(issued.record.idHash).toBe(await f.secrets.hash('session', issued.credential));
	expect(f.store.dump().includes(issued.credential)).toBe(false);
	const missing = await refusal(f.service.verify(null, '04829173'));
	const samCookie = await mailedProof(f, sam);
	const samCode = lastCode(f);
	const guess = () => refusal(f.service.verify(samCookie, wrongCode(samCode)));
	const spent = await Promise.all(Array.from({ length: proof.MAX_ATTEMPTS }, guess));
	const claimed = await refusal(f.service.verify(samCookie, samCode));
	expect(spent.map(({ code }) => code)).toEqual(
		Array(proof.MAX_ATTEMPTS).fill('email-code-invalid')
	);
	expect(claimed).toMatchObject({ code: 'email-code-invalid', status: 400 });
	expect(await f.service.status(samCookie)).toMatchObject({ sent: true });
	const session = {
		...issued.record,
		idHash: 'keyed hash',
		parentHash: 'keyed hash of the cookie'
	};
	const minted = { credentialCharacters: issued.credential.length, record: session };
	record('verify', 'verify-accepts-only-the-newest-code-and-issues-a-session', [
		{
			name: 'the older code after a newer one',
			input: { code: 'older mailed code', newerCodeMailed: true },
			error: stale
		},
		{ name: 'the newest mailed code', input: { code: 'newest mailed code' }, output: minted },
		{ name: 'no cookie at all', input: { cookie: null, code: '04829173' }, error: missing },
		{ name: 'five wrong codes, then the right one', input: { wrongCodes: 5 }, error: claimed }
	]);
});

test('proven holds for the verified address until 30 days pass', async () => {
	const f = fixture();
	const cookie = await mailedProof(f, riley);
	await f.service.verify(cookie, lastCode(f));
	const other = { ...riley, email: 'riley.morgan@example.net' };
	const sameAddress = await f.service.proven(riley);
	const otherAddress = await f.service.proven(other);
	const unproven = await f.service.proven(sam);
	f.move(proof.PROOF_TTL);
	const lapsed = await f.service.proven(riley);
	expect(sameAddress).toBe(true);
	expect(otherAddress).toBe(false);
	expect(unproven).toBe(false);
	expect(lapsed).toBe(false);
	record('proven', 'proven-holds-for-the-verified-address-until-30-days-pass', [
		{ name: 'riley, with the verified address', input: { actor: riley }, output: sameAddress },
		{ name: 'riley, with another address', input: { actor: other }, output: otherAddress },
		{ name: 'sam, who never verified an address', input: { actor: sam }, output: unproven },
		{ name: 'riley, 30 days later', input: { actor: riley, at: LAPSE }, output: lapsed }
	]);
});

test('cancel ends a proof and revokes the sessions it issued', async () => {
	const f = fixture();
	const { cookie } = await f.service.open(riley);
	const waiting = await f.service.open(sam);
	expect(await f.service.cancel(cookie)).toBeUndefined();
	const ended = await f.service.status(cookie);
	expect(await f.service.cancel(null)).toBeUndefined();
	const still = await f.service.status(waiting.cookie);
	const signedIn = await mailedProof(f, riley);
	const issued = await f.service.verify(signedIn, lastCode(f));
	const liveBefore = await f.sessions.find(issued.credential);
	await f.service.cancel(signedIn);
	const liveAfter = await f.sessions.find(issued.credential);
	expect([ended, still]).toEqual([null, { email: sam.email, sent: false, expiresAt: null }]);
	expect([liveBefore !== null, liveAfter]).toEqual([true, null]);
	const sessionLive = { before: liveBefore !== null, after: liveAfter !== null };
	record('cancel', 'cancel-ends-a-proof-and-revokes-the-sessions-it-issued', [
		{ name: 'riley cancels a pending proof', input: { cookie: OPENED }, output: { ended } },
		{ name: 'no cookie, while sam waits', input: { cookie: null }, output: { still } },
		{ name: 'riley cancels a signed-in proof', input: { cookie: 'signed-in' }, output: sessionLive }
	]);
});
