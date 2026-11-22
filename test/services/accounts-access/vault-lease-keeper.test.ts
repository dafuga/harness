import { expect, test } from 'vitest';
import {
	approval,
	sessionRequest,
	sessionUid,
	sign,
	vaultBroker
} from '../../support/credential-vault/broker';

const teardown = { logout: '/logout', revoke: null, securityLog: 'audit-page' };

function delivered(uid: number | null = sessionUid) {
	const fixture = vaultBroker();
	const input = sessionRequest(fixture.seal.runnerKey());
	const created = fixture.broker.create(input, uid);
	const ticket = { requestId: created.requestId, receipt: created.receipt };
	fixture.broker.decide(sign(fixture, input, approval(input, created, fixture)));
	fixture.broker.claim(ticket, uid);
	return { ...fixture, input, ticket };
}

function bearer(header: string): string {
	return header.replace(/^Bearer /u, '');
}

test('the session attaches once and only its user with its token is admitted', () => {
	const run = delivered();
	const { lease } = run.keeper.issue(run.ticket, sessionUid, teardown);
	expect(() => run.keeper.issue(run.ticket, sessionUid, teardown)).toThrow('already has a lease');
	expect(() => run.keeper.attach(lease, 'another-session', sessionUid)).toThrow('Lease not found.');
	const attached = run.keeper.attach(lease, run.input.session, sessionUid);
	expect(attached.endpoint).toMatch(/^ws\+unix:\/\/\/.+\/cdp\.sock:\/devtools\/browser$/u);
	expect(() => run.keeper.attach(lease, run.input.session, sessionUid)).toThrow('already attached');
	const token = bearer(attached.headers.Authorization);
	expect(run.keeper.admit(lease, sessionUid, token)).toEqual({ allowed: true });
	expect(run.keeper.admit(lease, 777, token).allowed).toBe(false);
	expect(run.keeper.admit(lease, null, token).allowed).toBe(false);
	expect(run.keeper.admit(lease, sessionUid, 'wrong').allowed).toBe(false);
});

test('finish ends the lease with logout, removal and two security log reads', () => {
	const run = delivered();
	const { lease } = run.keeper.issue(run.ticket, sessionUid, teardown);
	const token = bearer(
		run.keeper.attach(lease, run.input.session, sessionUid).headers.Authorization
	);
	const ended = run.keeper.finish(lease, run.input.session, sessionUid);
	expect(ended.ended).toBe('finished');
	expect(ended.teardown.map(({ step }) => step)).toEqual([
		'close-cdp-endpoint',
		'provider-logout',
		'remove-container',
		'verify-removal',
		'security-log',
		'security-log'
	]);
	expect(run.keeper.admit(lease, sessionUid, token).allowed).toBe(false);
	expect(() => run.keeper.finish(lease, run.input.session, sessionUid)).toThrow('ended');
	expect(run.audit.outstanding()).toEqual([]);
});

test('an unclaimed lease ends after 60 s and is planned once by the sweep', () => {
	const run = delivered();
	const { lease } = run.keeper.issue(run.ticket, sessionUid, { ...teardown, securityLog: null });
	run.clock.now += 60_000;
	const plans = run.keeper.sweep();
	expect(plans).toHaveLength(1);
	expect(plans[0]).toMatchObject({ lease, ended: 'unclaimed' });
	expect(plans[0]?.teardown.at(-1)).toMatchObject({ step: 'flag-unverifiable' });
	expect(run.keeper.sweep()).toEqual([]);
	expect(() => run.keeper.attach(lease, run.input.session, sessionUid)).toThrow('ended');
});

test('no lease is issued without a kernel-verified session user or before delivery', () => {
	const unknown = delivered(null);
	expect(() => unknown.keeper.issue(unknown.ticket, null, teardown)).toThrow('kernel-verified');
	const fixture = vaultBroker();
	const input = sessionRequest(fixture.seal.runnerKey());
	const created = fixture.broker.create(input, sessionUid);
	const ticket = { requestId: created.requestId, receipt: created.receipt };
	expect(() => fixture.keeper.issue(ticket, sessionUid, teardown)).toThrow('not delivered');
});
