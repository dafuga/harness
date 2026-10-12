import { SignJWT, base64url } from 'jose';
import { beforeAll, expect, test } from 'vitest';
import { GoogleIdentityService } from '../../src/services/GoogleIdentityService';
import { AuthFailure } from '../../src/utils/authFail';
import { CLIENT_ID, KEY_ID, START, googleFixture } from '../support/googleFixture';
import type { GoogleFixture } from '../support/googleFixture';

const nonce = 'n'.repeat(43);
let clock = START;
let google: GoogleFixture;
let service: GoogleIdentityService;

beforeAll(async () => {
	google = await googleFixture(() => clock);
	service = new GoogleIdentityService({ clientId: CLIENT_ID, keys: google.keys, now: () => clock });
});

async function code(credential: Promise<string> | string, expected = nonce): Promise<string> {
	try {
		await service.verify(await credential, expected);
		return 'accepted';
	} catch (error) {
		return error instanceof AuthFailure ? error.code : `unexpected:${String(error)}`;
	}
}

test('a Google-signed credential becomes an actor keyed by issuer and subject', async () => {
	const identity = await service.verify(await google.sign(google.claims(nonce)), nonce);
	expect(identity.authoritative).toBe(true);
	expect(identity.actor).toEqual({
		id: 'google-110000000000000000001',
		email: 'ada@gmail.com',
		name: 'Ada Example',
		emailVerified: true
	});
	const bare = google.claims(nonce, { iss: 'accounts.google.com', email: 'Ada@Gmail.com' });
	expect((await service.verify(await google.sign(bare), nonce)).actor.email).toBe('ada@gmail.com');
});

test('a signature from any other key is rejected, even under the trusted key id', async () => {
	expect(await code(google.forge(google.claims(nonce)))).toBe('credential-invalid');
});

test('claims changed after signing are rejected', async () => {
	const [header, , signature] = (await google.sign(google.claims(nonce))).split('.');
	const edited = google.claims(nonce, { sub: '220000000000000000002', email: 'eve@gmail.com' });
	const payload = base64url.encode(JSON.stringify(edited));
	expect(await code(`${header}.${payload}.${signature}`)).toBe('credential-invalid');
});

test('unsigned and symmetric-key credentials are rejected', async () => {
	const part = (value: object) => base64url.encode(JSON.stringify(value));
	const unsigned = `${part({ alg: 'none', typ: 'JWT' })}.${part(google.claims(nonce))}.`;
	expect(await code(unsigned)).toBe('credential-invalid');
	const confused = new SignJWT(google.claims(nonce))
		.setProtectedHeader({ alg: 'HS256', kid: KEY_ID })
		.sign(new TextEncoder().encode(google.publicPem));
	expect(await code(confused)).toBe('credential-invalid');
	expect(await code('not-a-jwt')).toBe('credential-invalid');
});

test('the audience must be exactly this client', async () => {
	const other = 'other-client.apps.googleusercontent.com';
	expect(await code(google.sign(google.claims(nonce, { aud: other })))).toBe('credential-invalid');
	const shared = google.claims(nonce, { aud: [CLIENT_ID, other] });
	expect(await code(google.sign(shared))).toBe('credential-invalid');
	const delegated = google.claims(nonce, { azp: other });
	expect(await code(google.sign(delegated))).toBe('credential-invalid');
});

test('only the two official Google issuers are accepted', async () => {
	const lookalike = google.claims(nonce, { iss: 'https://accounts.google.com.evil.example' });
	expect(await code(google.sign(lookalike))).toBe('credential-invalid');
	expect(await code(google.sign(google.claims(nonce, { iss: undefined })))).toBe(
		'credential-invalid'
	);
});

test('an expired credential is rejected by the server clock', async () => {
	const credential = await google.sign(google.claims(nonce));
	expect(await code(credential)).toBe('accepted');
	clock = START + 3_700_000;
	expect(await code(credential)).toBe('credential-invalid');
	clock = START;
	expect(await code(google.sign(google.claims(nonce, { exp: undefined })))).toBe(
		'credential-invalid'
	);
});

test('the nonce must be the one this server issued', async () => {
	const credential = await google.sign(google.claims(nonce));
	expect(await code(credential, 'm'.repeat(43))).toBe('credential-invalid');
	expect(await code(google.sign(google.claims(nonce, { nonce: undefined })))).toBe(
		'credential-invalid'
	);
});

test('an unverified email or a missing subject is rejected', async () => {
	const sign = (overrides: Record<string, unknown>) => google.sign(google.claims(nonce, overrides));
	expect(await code(sign({ email_verified: false }))).toBe('credential-invalid');
	expect(await code(sign({ email_verified: 'true' }))).toBe('credential-invalid');
	expect(await code(sign({ email: undefined }))).toBe('credential-invalid');
	expect(await code(sign({ sub: undefined }))).toBe('credential-invalid');
	expect(await code(sign({ sub: '../admin' }))).toBe('credential-invalid');
});

test('Google vouches for Gmail and Workspace mailboxes only, and says which it is', async () => {
	const vouched = async (overrides: Record<string, unknown>) =>
		(await service.verify(await google.sign(google.claims(nonce, overrides)), nonce)).authoritative;
	expect(await vouched({})).toBe(true);
	expect(await vouched({ email: 'ada@example.org', hd: 'example.org' })).toBe(true);
	expect(await vouched({ email: 'ada@example.org' })).toBe(false);
	expect(await vouched({ email: 'ada@notgmail.com' })).toBe(false);
	expect(await vouched({ email: 'ada@example.org', hd: '' })).toBe(false);
	const unverified = google.claims(nonce, { email: 'ada@example.org', email_verified: false });
	expect(await code(google.sign(unverified))).toBe('credential-invalid');
});

test('identity follows the subject, never the email address', async () => {
	const actor = async (overrides: Record<string, unknown>) =>
		(await service.verify(await google.sign(google.claims(nonce, overrides)), nonce)).actor;
	const original = await actor({});
	const renamed = await actor({ email: 'ada.renamed@gmail.com' });
	const impostor = await actor({ sub: '220000000000000000002' });
	expect(renamed.id).toBe(original.id);
	expect(impostor.email).toBe(original.email);
	expect(impostor.id).not.toBe(original.id);
});

test('a missing display name falls back to the mailbox name', async () => {
	const credential = await google.sign(google.claims(nonce, { name: '   ' }));
	expect((await service.verify(credential, nonce)).actor.name).toBe('ada');
});
