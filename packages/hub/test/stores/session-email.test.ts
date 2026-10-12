import { expect, test, vi } from 'vitest';
import { createSessionStore } from '../../src/lib/stores/session.svelte';
import type { BrowserAuth } from '../../src/utils/browserAuth';

const ada = {
	id: 'google:1',
	email: 'ada@third.invalid',
	name: 'Ada',
	emailVerified: true as const
};
const proofOf = (sent: boolean) => ({
	email: ada.email,
	sent,
	expiresAt: sent ? '2026-10-12T12:10:00Z' : null
});
/** A server that keeps one pending address until `sign()` is called. */
function serverOf() {
	const state = { actor: null as typeof ada | null, sent: false };
	const status = vi.fn(async () => ({
		actor: state.actor,
		configured: true,
		clientId: 'client-1',
		...(state.actor ? {} : { emailProof: proofOf(state.sent) })
	}));
	return { state, status };
}

test('a pending address signs nobody in, and a code is sent only when asked', async () => {
	const { state, status } = serverOf();
	const emailStart = vi.fn(async () => {
		state.sent = true;
	});
	const session = createSessionStore({ status, emailStart } as unknown as BrowserAuth);
	await session.refresh();
	expect(session.actor).toBeNull();
	expect(session.emailProof).toEqual(proofOf(false));
	expect(emailStart).not.toHaveBeenCalled();
	await session.sendEmailCode();
	expect(emailStart).toHaveBeenCalledTimes(1);
	expect(session.emailProof?.sent).toBe(true);
	expect(session.actor).toBeNull();
});

test('a wrong code leaves the address pending and says why', async () => {
	const { status } = serverOf();
	const emailVerify = vi.fn(async () => {
		throw new Error('That code is not right or has expired.');
	});
	const session = createSessionStore({ status, emailVerify } as unknown as BrowserAuth);
	await session.refresh();
	expect(await session.verifyEmail('111111')).toBe(false);
	expect(emailVerify).toHaveBeenCalledWith('111111');
	expect(session.error).toMatch(/not right/);
	expect(session.emailProof).not.toBeNull();
	expect(session.busy).toBe(false);
});

test('only the status the server then gives signs a person in', async () => {
	const { state, status } = serverOf();
	const emailVerify = vi.fn(async () => ({ actor: ada }));
	const session = createSessionStore({ status, emailVerify } as unknown as BrowserAuth);
	await session.refresh();
	expect(await session.verifyEmail('24681012')).toBe(false);
	expect(session.actor).toBeNull();
	state.actor = ada;
	expect(await session.verifyEmail('24681012')).toBe(true);
	expect(session.actor).toEqual(ada);
	expect(session.emailProof).toBeNull();
});
