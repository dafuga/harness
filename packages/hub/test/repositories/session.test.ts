import { expect, test } from 'vitest';
import {
	BROWSER_TTL,
	NATIVE_TTL,
	SessionRepository
} from '../../src/repositories/SessionRepository';
import { authSecrets } from '../../src/utils/authSecrets';
import { ada, authFixture, browserGrant } from '../support/authFixture';

test('a session credential is opaque and only its keyed hash is stored', async () => {
	const fixture = authFixture();
	const { credential, record } = await fixture.sessions.issue(browserGrant());
	expect(credential).toMatch(/^[A-Za-z0-9_-]{43}$/);
	expect(credential.split('.')).toHaveLength(1);
	expect(fixture.store.dump()).not.toContain(credential);
	expect(record.idHash).toMatch(/^[a-f0-9]{64}$/);
	expect(await fixture.sessions.find(credential)).toMatchObject({ actor: ada, kind: 'browser' });
});

test('knowing a stored identifier or an actor id does not authenticate', async () => {
	const fixture = authFixture();
	const { record } = await fixture.sessions.issue(browserGrant());
	expect(await fixture.sessions.find(record.idHash)).toBeNull();
	expect(await fixture.sessions.find(ada.id)).toBeNull();
	expect(await fixture.sessions.find('x'.repeat(43))).toBeNull();
});

test('a credential is useless under another session secret', async () => {
	const fixture = authFixture();
	const { credential } = await fixture.sessions.issue(browserGrant());
	const rotated = new SessionRepository({
		store: fixture.store.sessions,
		secrets: authSecrets('rotated-session-secret-0123456789abcdef'),
		now: fixture.now
	});
	expect(await rotated.find(credential)).toBeNull();
});

test('sessions expire on the server clock', async () => {
	const fixture = authFixture();
	const browser = await fixture.sessions.issue(browserGrant());
	const native = await fixture.sessions.issue({ ...browserGrant(), kind: 'native' });
	expect(native.record.expiresAt - native.record.createdAt).toBe(NATIVE_TTL);
	fixture.advance(BROWSER_TTL - 1);
	expect(await fixture.sessions.find(browser.credential)).not.toBeNull();
	fixture.advance(1);
	expect(await fixture.sessions.find(browser.credential)).toBeNull();
	expect(await fixture.sessions.find(native.credential)).not.toBeNull();
	fixture.advance(NATIVE_TTL);
	expect(await fixture.sessions.find(native.credential)).toBeNull();
});

test('revoking a browser session ends it and the native sessions it approved', async () => {
	const fixture = authFixture();
	const browser = await fixture.sessions.issue(browserGrant());
	const other = await fixture.sessions.issue(browserGrant());
	const child = { ...browserGrant(), kind: 'native' as const, parentHash: browser.record.idHash };
	const native = await fixture.sessions.issue(child);
	await fixture.sessions.revoke(browser.record);
	expect(await fixture.sessions.find(browser.credential)).toBeNull();
	expect(await fixture.sessions.find(native.credential)).toBeNull();
	expect(await fixture.sessions.find(other.credential)).not.toBeNull();
});

test('revoking a native session leaves the browser session that approved it', async () => {
	const fixture = authFixture();
	const browser = await fixture.sessions.issue(browserGrant());
	const child = { ...browserGrant(), kind: 'native' as const, parentHash: browser.record.idHash };
	const native = await fixture.sessions.issue(child);
	await fixture.sessions.revoke(native.record);
	expect(await fixture.sessions.find(native.credential)).toBeNull();
	expect(await fixture.sessions.find(browser.credential)).not.toBeNull();
});
