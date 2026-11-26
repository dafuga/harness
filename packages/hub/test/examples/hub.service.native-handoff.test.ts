import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { HANDOFF_TTL } from '../../src/lib/verification-evidence/server/auth/native-handoff-service/NativeHandoffService';
import type { Begun, Case } from './hub.service.native-handoff.test.types';
import {
	fixture,
	begin,
	projects,
	project,
	approver,
	approval,
	record,
	outcome,
	redact,
	REFUSED
} from './hub.service.native-handoff.cases';
export { begin } from './hub.service.native-handoff.cases';

const UNKNOWN_HANDOFF = 'Zr8wN2hQ5cLx0VdTb7KgE3mUoA9pYs1JfWiCnH4aRtD';

/** The desktop's single attempt: its handoff id, verifier, nonce and resource. */
function exchangeFor(started: Begun) {
	const { verifier, nonce, resource } = started.desktop;
	return { handoffId: started.handoffId, verifier, nonce, resource };
}

test('poll reports pending, approved and expired handoffs', async () => {
	const { service, clock } = fixture();
	const pending = await begin(service, projects);
	const approved = await begin(service, project);
	await service.approve(approver, approval(approved));
	const waiting = await service.poll(pending.handoffId);
	const done = await service.poll(approved.handoffId);
	const missing = await service.poll(UNKNOWN_HANDOFF);
	clock.now += HANDOFF_TTL;
	const late = await service.poll(pending.handoffId);
	expect(waiting).toEqual({ status: 'pending', resource: 'projects' });
	expect(done).toEqual({ status: 'approved', resource: project.resource });
	expect(missing).toEqual({ status: 'expired', resource: null });
	expect(late).toEqual({ status: 'expired', resource: null });
	const cases: Case[] = [
		{
			name: 'a live handoff is pending until it is approved',
			input: pending.handoffId,
			output: waiting
		},
		{
			name: 'an approved handoff reports the project it grants',
			input: approved.handoffId,
			output: done
		},
		{
			name: 'an unknown handoff id is reported as expired',
			input: UNKNOWN_HANDOFF,
			output: missing
		},
		{ name: 'a handoff is expired from its expiry time on', input: pending.handoffId, output: late }
	];
	record('poll', 'poll-reports-pending-approved-and-expired-handoffs', cases);
});

test('exchange issues one native session for an approved handoff', async () => {
	const { service, store, sessions, clock } = fixture();
	await store.sessions.create(approver);
	const first = await begin(service, projects);
	const second = await begin(service, project);
	await service.approve(approver, approval(first));
	await service.approve(approver, approval(second));
	clock.now += 60 * 1000;
	const granted = await service.exchange(exchangeFor(first));
	const grantedSecond = await service.exchange(exchangeFor(second));
	const repeated = await outcome(() => service.exchange(exchangeFor(first)));
	const session = await sessions.find(granted.authorization);
	expect(redact(granted, [granted.authorization])).toEqual({
		authorization: '<redacted>',
		actor: approver.actor,
		audience: 'harness-desktop',
		resource: 'projects',
		nonce: projects.nonce,
		expiresAt: '2026-12-15T09:01:00.000Z'
	});
	expect(grantedSecond.resource).toBe(project.resource);
	expect(session).toMatchObject({
		kind: 'native',
		parentHash: approver.idHash,
		resource: 'projects'
	});
	expect(store.dump().includes(granted.authorization)).toBe(false);
	expect(repeated).toEqual({ error: REFUSED });
	const cases: Case[] = [
		{
			name: 'the projects handoff exchanges once for its approver',
			input: exchangeFor(first),
			output: granted
		},
		{
			name: 'the project handoff exchanges for its own resource',
			input: exchangeFor(second),
			output: grantedSecond
		},
		{
			name: 'a repeated exchange of the projects handoff is refused',
			input: exchangeFor(first),
			...repeated
		}
	];
	const secrets = [
		projects.verifier,
		project.verifier,
		granted.authorization,
		grantedSecond.authorization
	];
	record(
		'exchange',
		'exchange-issues-one-native-session-for-an-approved-handoff',
		redact(cases, secrets)
	);
});

test('exchange refuses wrong verifiers and signed-out approvers', async () => {
	const { service, store, sessions } = fixture();
	await store.sessions.create(approver);
	const first = await begin(service, projects);
	const second = await begin(service, project);
	await service.approve(approver, approval(first));
	await service.approve(approver, approval(second));
	const guess = { ...exchangeFor(first), verifier: project.verifier };
	const wrong = await outcome(() => service.exchange(guess));
	const right = await outcome(() => service.exchange(exchangeFor(first)));
	await sessions.revoke(approver);
	const signedOut = await outcome(() => service.exchange(exchangeFor(second)));
	expect([wrong, right, signedOut]).toEqual([
		{ error: REFUSED },
		{ error: REFUSED },
		{ error: REFUSED }
	]);
	expect((await store.exchanges.find(first.handoffId))?.status).toBe('consumed');
	const cases: Case[] = [
		{ name: 'a wrong verifier is refused and uses the handoff up', input: guess, ...wrong },
		{
			name: 'the right verifier is refused once the handoff is spent',
			input: exchangeFor(first),
			...right
		},
		{
			name: 'an approved handoff is refused after its approver signs out',
			input: exchangeFor(second),
			...signedOut
		}
	];
	record(
		'exchange',
		'exchange-refuses-wrong-verifiers-and-signed-out-approvers',
		redact(cases, [projects.verifier, project.verifier])
	);
});
