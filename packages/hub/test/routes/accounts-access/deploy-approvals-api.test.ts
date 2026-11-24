import { randomUUID } from 'node:crypto';
import { approvalCardFixture } from '../../../../../test/support/scripted-deploy/approvalCardFixture';
import type { ApprovalCard } from '../../../../../src/core/execution-runtimes/scripted-deploy/approvalInbox.types';
import { deployApprovalFixture } from '../../support/deployApprovalFixture';
import { OWNER } from '../../support/trackerOverviewFixture';
import { expect, test } from 'vitest';
import { GET } from '../../../src/routes/(accounts-access)/api/deploy-approvals/+server';

test('deploy approvals are unavailable without a configured native owner and live session', async () => {
	const response = await Reflect.apply(GET, undefined, [
		{ request: new Request('https://hub.fixture.test/api/deploy-approvals') }
	]);
	expect(response.status).toBe(404);
	expect(response.headers.get('cache-control')).toBe('private, no-store');
	expect(await response.json()).toEqual({ error: 'not-found' });
});

test('only the configured native owner can decide one current release, and only the scoped runner claims an allow once', async () => {
	const fixture = await deployApprovalFixture();
	try {
		const card = approvalCardFixture(fixture.now + 2000);
		const decide = { id: card.id, plan: card.plan, decision: 'allow' };
		const collect = {
			id: card.id,
			plan: card.plan,
			kind: 'collect',
			project: card.project,
			environment: card.environment
		};
		expect(
			await response(
				await fixture.runner({ kind: 'register', card: { ...card, environment: 'prod' } })
			)
		).toEqual([404, { error: 'not-found' }]);
		expect(await response(await fixture.runner({ kind: 'register', card }))).toEqual([
			201,
			{ status: 'pending' }
		]);
		expect(await response(await fixture.session())).toEqual([
			200,
			[{ ...card, receipt: null, used: false }]
		]);
		await refuseUnscopedDecisions(fixture, decide, collect);
		const decisions = await Promise.all([fixture.session(decide), fixture.session(decide)]);
		expect(decisions.map((item) => item.status).sort()).toEqual([200, 409]);
		const receipt = await decisions.find((item) => item.ok)!.json();
		expect(receipt).toEqual({
			...decide,
			receipt: expect.any(String),
			actor: OWNER.id,
			decidedAt: expect.any(Number)
		});
		const claimed = await Promise.all([fixture.runner(collect), fixture.runner(collect)]);
		expect(await Promise.all(claimed.map((item) => item.json()))).toEqual(
			expect.arrayContaining([{ status: 'allowed', receipt }, { status: 'refused' }])
		);
		expect(await response(await fixture.session())).toEqual([
			200,
			[{ ...card, receipt, used: true }]
		]);
		expect(await response(await fixture.runner({ kind: 'register', card }))).toEqual([
			409,
			{ error: 'approval-unavailable' }
		]);
	} finally {
		await fixture.close();
	}
}, 20_000);

test('denial, expiration, and revoked device or runner grants all prevent collection', async () => {
	const fixture = await deployApprovalFixture();
	try {
		const card = approvalCardFixture(fixture.now + 1000);
		const denied = await register(fixture, card);
		const expired = await register(fixture, { ...card, id: randomUUID() });
		const revoked = await register(fixture, {
			...card,
			id: randomUUID(),
			expiresAt: fixture.now + 6000
		});
		expect(
			(await fixture.session({ id: denied.id, plan: denied.plan, decision: 'deny' })).status
		).toBe(200);
		expect(
			(await fixture.session({ id: revoked.id, plan: revoked.plan, decision: 'allow' })).status
		).toBe(200);
		fixture.advance(1100);
		for (const attempt of [denied, expired]) {
			expect(await response(await fixture.runner(attempt))).toEqual([200, { status: 'refused' }]);
			expect(
				(await fixture.session({ id: attempt.id, plan: attempt.plan, decision: 'allow' })).status
			).toBe(409);
		}
		await fixture.revoke();
		expect(await response(await fixture.runner(revoked))).toEqual([200, { status: 'refused' }]);
		expect((await fixture.session()).status).toBe(404);
		fixture.withdrawRunner();
		expect(await response(await fixture.runner(revoked))).toEqual([404, { error: 'not-found' }]);
	} finally {
		await fixture.close();
	}
}, 20_000);

async function refuseUnscopedDecisions(
	fixture: Awaited<ReturnType<typeof deployApprovalFixture>>,
	decide: { id: string; plan: string; decision: string },
	collect: unknown
) {
	for (const result of await Promise.all([
		fixture.nonOwner(decide),
		fixture.scoped(decide),
		fixture.browser(decide)
	]))
		expect(await response(result)).toEqual([404, { error: 'not-found' }]);
	expect(await response(await fixture.session({ ...decide, plan: '9'.repeat(64) }))).toEqual([
		409,
		{ error: 'approval-unavailable' }
	]);
	expect(
		await response(await fixture.session({ answer: 'Yes, deploy', item: 'fixture-item' }))
	).toEqual([400, { error: 'invalid-input' }]);
	expect(await response(await fixture.runner(collect))).toEqual([200, { status: 'pending' }]);
}

async function response(reply: Response) {
	return [reply.status, await reply.json()];
}

async function register(
	fixture: Awaited<ReturnType<typeof deployApprovalFixture>>,
	card: ApprovalCard
) {
	expect((await fixture.runner({ kind: 'register', card })).status).toBe(201);
	const { project, environment, id, plan } = card;
	return { kind: 'collect', project, environment, id, plan };
}
