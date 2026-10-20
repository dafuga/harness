import { expect, test } from 'vitest';
import {
	HANDOFF_TTL,
	NativeHandoffService
} from '../../src/services/native-handoff-service/NativeHandoffService';
import { normalizeCode } from '../../src/services/native-handoff-service/authSecrets';
import { randomToken, sha256Url } from '../../src/utils/authSecrets';
import { ORIGIN, ada, authFixture, browserGrant, grace } from '../support/authFixture';
import type { AuthFixture } from '../support/authFixture';

function service(fixture: AuthFixture, scope: { origin?: string; environment?: 'local' } = {}) {
	return new NativeHandoffService({
		store: fixture.store.exchanges,
		sessions: fixture.sessions,
		secrets: fixture.secrets,
		origin: scope.origin ?? ORIGIN,
		environment: scope.environment ?? 'staging',
		now: fixture.now
	});
}

/** What the desktop app holds: a verifier and nonce that never leave it before the exchange. */
async function begin(resource = 'projects') {
	const fixture = authFixture();
	const handoff = service(fixture);
	const verifier = randomToken();
	const nonce = randomToken(16);
	const started = await handoff.start({ challenge: await sha256Url(verifier), nonce, resource });
	const browser = await fixture.sessions.issue(browserGrant());
	const input = { handoffId: started.handoffId, verifier, nonce, resource };
	const approval = { handoffId: started.handoffId, userCode: normalizeCode(started.userCode) };
	return { fixture, handoff, started, browser, input, approval };
}

test('an approved handoff is exchanged for an opaque native session bound to its approver', async () => {
	const { fixture, handoff, started, browser, input, approval } = await begin();
	expect(await handoff.poll(started.handoffId)).toEqual({
		status: 'pending',
		resource: 'projects'
	});
	expect(await handoff.approve(browser.record, approval)).toEqual({
		approved: true,
		resource: 'projects'
	});
	expect((await handoff.poll(started.handoffId)).status).toBe('approved');
	const native = await handoff.exchange(input);
	expect(native).toMatchObject({ actor: ada, audience: 'harness-desktop', nonce: input.nonce });
	expect(native.authorization.split('.')).toHaveLength(1);
	expect(await fixture.sessions.find(native.authorization)).toMatchObject({
		kind: 'native',
		parentHash: browser.record.idHash,
		resource: 'projects'
	});
});

test('nothing reusable is in the browser URL, the start result, a poll or the store', async () => {
	const { fixture, handoff, started, browser, input, approval } = await begin();
	expect(started.verificationUrl).toBe(`${ORIGIN}/native/${started.handoffId}`);
	expect(new URL(started.verificationUrl).search).toBe('');
	expect(JSON.stringify(started)).not.toContain(input.verifier);
	await handoff.approve(browser.record, approval);
	const native = await handoff.exchange(input);
	const visible = JSON.stringify([started, await handoff.poll(started.handoffId)]);
	for (const secret of [native.authorization, input.verifier, input.nonce]) {
		expect(visible).not.toContain(secret);
		expect(fixture.store.dump()).not.toContain(secret);
	}
	expect(fixture.store.dump()).not.toContain(approval.userCode);
});

test('an exchange is accepted once, also under concurrency', async () => {
	const { handoff, browser, input, approval, fixture } = await begin();
	await handoff.approve(browser.record, approval);
	const attempts = await Promise.allSettled([1, 2, 3].map(() => handoff.exchange(input)));
	expect(attempts.filter((attempt) => attempt.status === 'fulfilled')).toHaveLength(1);
	await expect(handoff.exchange(input)).rejects.toThrow('handoff-invalid');
	expect(fixture.store.dump().match(/"kind":"native"/g)).toHaveLength(1);
});

test('a wrong verifier fails and spends the handoff', async () => {
	const { handoff, browser, input, approval } = await begin();
	await handoff.approve(browser.record, approval);
	const guess = { ...input, verifier: randomToken() };
	await expect(handoff.exchange(guess)).rejects.toThrow('handoff-invalid');
	await expect(handoff.exchange(input)).rejects.toThrow('handoff-invalid');
});

test('a wrong nonce or resource fails the exchange', async () => {
	const nonce = await begin('project:p-1');
	await nonce.handoff.approve(nonce.browser.record, nonce.approval);
	const other = { ...nonce.input, nonce: randomToken(16) };
	await expect(nonce.handoff.exchange(other)).rejects.toThrow('handoff-invalid');
	const resource = await begin('project:p-1');
	await resource.handoff.approve(resource.browser.record, resource.approval);
	for (const wider of ['projects', 'project:p-2']) {
		const attempt = resource.handoff.exchange({ ...resource.input, resource: wider });
		await expect(attempt).rejects.toThrow('handoff-invalid');
	}
});

test('approval needs the typed code, a live handoff, and happens once', async () => {
	const { handoff, browser, input, approval, fixture } = await begin();
	await expect(handoff.exchange(input)).rejects.toThrow('handoff-invalid');
	const wrong = {
		...approval,
		userCode: approval.userCode === 'AAAAAAAA' ? 'BBBBBBBB' : 'AAAAAAAA'
	};
	await expect(handoff.approve(browser.record, wrong)).rejects.toThrow('handoff-invalid');
	await handoff.approve(browser.record, approval);
	const second = await fixture.sessions.issue(browserGrant(grace));
	await expect(handoff.approve(second.record, approval)).rejects.toThrow('handoff-invalid');
	expect((await handoff.exchange(input)).actor).toEqual(ada);
});

test('a handoff expires for approval, polling and exchange', async () => {
	const late = await begin();
	late.fixture.advance(HANDOFF_TTL);
	await expect(late.handoff.approve(late.browser.record, late.approval)).rejects.toThrow(
		'handoff-invalid'
	);
	expect(await late.handoff.poll(late.started.handoffId)).toEqual({
		status: 'expired',
		resource: null
	});
	const approved = await begin();
	await approved.handoff.approve(approved.browser.record, approved.approval);
	approved.fixture.advance(HANDOFF_TTL);
	await expect(approved.handoff.exchange(approved.input)).rejects.toThrow('handoff-invalid');
	expect((await approved.handoff.poll(randomToken())).status).toBe('expired');
});

test('a handoff cannot be exchanged in another environment or at another origin', async () => {
	for (const scope of [{ environment: 'local' as const }, { origin: 'https://other.test' }]) {
		const { fixture, handoff, browser, input, approval } = await begin();
		await handoff.approve(browser.record, approval);
		await expect(service(fixture, scope).exchange(input)).rejects.toThrow('handoff-invalid');
	}
});

test('signing out before the exchange cancels it; signing out after revokes the session', async () => {
	const before = await begin();
	await before.handoff.approve(before.browser.record, before.approval);
	await before.fixture.sessions.revoke(before.browser.record);
	await expect(before.handoff.exchange(before.input)).rejects.toThrow('handoff-invalid');
	const after = await begin();
	await after.handoff.approve(after.browser.record, after.approval);
	const native = await after.handoff.exchange(after.input);
	await after.fixture.sessions.revoke(after.browser.record);
	expect(await after.fixture.sessions.find(native.authorization)).toBeNull();
});

test('the approver recorded on the handoff must be the session that approved it', async () => {
	const { fixture, handoff, browser, input, approval } = await begin();
	await handoff.approve(browser.record, approval);
	const stored = await fixture.store.exchanges.find(input.handoffId);
	await fixture.store.exchanges.create({ ...stored!, subject: grace.id });
	await expect(handoff.exchange(input)).rejects.toThrow('handoff-invalid');
});

test('a sign-out that lands while the exchange is being issued still wins', async () => {
	const { fixture, handoff, browser, input, approval } = await begin();
	await handoff.approve(browser.record, approval);
	const create = fixture.store.sessions.create;
	fixture.store.sessions.create = async (record) => {
		await fixture.sessions.revoke(browser.record);
		await create(record);
	};
	await expect(handoff.exchange(input)).rejects.toThrow('handoff-invalid');
	const native = fixture.store.dump().match(/"kind":"native"[^}]*"revokedAt":(\w+)/);
	expect(native?.[1]).not.toBe('null');
});
