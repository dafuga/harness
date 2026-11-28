import { test } from 'vitest';
import { expect } from '../../verificationExpect';
import { verifyStartedRecoveryBeforeDue } from '../../support/trackerDueLaunchFixture';
import {
	dispatcherFixture,
	primary,
	sampleId,
	sampleToken,
	started
} from '../../support/trackerDispatcherFixture';

test('due intent uses a local-zone date, holds future or ineligible work and keeps the scheduled selection', async () => {
	const fixture = dispatcherFixture({
		due: { enabled: true, paused: false },
		policy: { hub: true }
	});
	const { changeItem, service, policy, runs } = fixture;
	const due = { source: 'due', token: sampleToken } as const;
	await verifyRecoveryGates(fixture);
	await verifyStartedRecoveryBeforeDue();

	changeItem({ due: '2026-11-21' });
	await verifyQueuedLaunchGates(fixture);
	expect(await service.request(sampleId, due)).toEqual({
		status: 'held',
		reason: 'item is not due'
	});
	changeItem({ due: '2026-11-20', scheduleOff: true });
	expect(await service.request(sampleId, due)).toEqual({
		status: 'held',
		reason: 'automatic launch opted out'
	});
	changeItem({ scheduleOff: false, agent: 'cos-bot' });
	expect(await service.request(sampleId, due)).toMatchObject({
		status: 'held',
		reason: expect.stringContaining('Chief of Staff')
	});
	changeItem({ agent: null, recurring: true });
	expect(await service.request(sampleId, due)).toEqual({
		status: 'held',
		reason: 'recurring item'
	});
	changeItem({ recurring: false, status: 'in_progress' });
	expect(await service.request(sampleId, due)).toEqual({
		status: 'held',
		reason: 'item is already in progress'
	});
	changeItem({ status: 'open', notes: 'Synthetic scope for model classification.' });
	const defaultPick = policy.pickModel;
	policy.pickModel = (item) => {
		expect(item.notes).toBe('Synthetic scope for model classification.');
		return defaultPick(item);
	};
	expect(await service.request(sampleId, due)).toMatchObject({
		status: 'requested',
		intent: { source: 'due', target: primary, scheduledPick: { rung: { id: 'haiku' } } }
	});
	expect(runs()).toEqual([]);
	policy.pickModel = () => ({ error: 'changed ladder from preview' });
	expect(started(await service.claim(sampleId, sampleToken)).selection).toEqual({
		provider: 'claude',
		model: 'claude-haiku-5-5',
		intelligence: 'high'
	});
});

async function verifyQueuedLaunchGates({
	changeItem,
	service,
	runs
}: ReturnType<typeof dispatcherFixture>) {
	const launch = { source: 'automatic', token: 'already-queued', target: primary } as const;
	changeItem({ launch });
	expect.soft(await service.claim(sampleId, launch.token)).toEqual({
		status: 'held',
		reason: 'item is not due'
	});
	expect.soft(runs()).toEqual([]);
	changeItem({ launch: null });
}

async function verifyRecoveryGates({
	changeItem,
	service,
	policy
}: ReturnType<typeof dispatcherFixture>) {
	const recovery = { source: 'recovery', token: 'resume', expectedAuto: null } as const;
	for (const item of [
		{ scheduleOff: true },
		{ agent: 'cos' },
		{ agent: 'dad' },
		{ title: 'Remind Daniel tomorrow' },
		{ title: 'Watch: next update' },
		{ title: 'Approved PROD DEPLOY' },
		{ kind: 'reminder' },
		{ kind: 'plan' },
		{ awaitingAnswer: true, question: 'What do you think?' },
		{ parkedUntil: policy.now() + 60_000 },
		{ due: new Date(policy.now() + 1).toISOString() },
		{ status: 'blocked' as const },
		{ status: 'done' as const }
	]) {
		changeItem({
			status: 'in_progress',
			kind: 'task',
			agent: null,
			title: 'Update synthetic fixture',
			scheduleOff: false,
			awaitingAnswer: false,
			parkedUntil: 0,
			due: '2026-11-20',
			...item
		});
		expect.soft(await service.request(sampleId, recovery), JSON.stringify(item)).not.toMatchObject({
			status: 'requested'
		});
		changeItem({ launch: null });
	}
	changeItem({ status: 'open', parkedUntil: 0, due: '2026-11-20' });
}

test('a reachable denial beats local fallback, while a sole owner can start during an outage', async () => {
	const fixture = dispatcherFixture({ due: { enabled: true, paused: false, localDue: true } });
	const { service, changeItem, conditions, runs } = fixture;
	const due = { source: 'due', token: sampleToken } as const;
	changeItem({ computer: 'mb2' });
	expect(await service.request(sampleId, due)).toMatchObject({ status: 'held' });
	changeItem({ computer: null });
	expect(await service.request(sampleId, due)).toMatchObject({ status: 'requested' });
	const grant = { token: sampleToken, node: 'mac', decision: 'unreachable' } as const;
	expect(
		await service.claim(sampleId, sampleToken, { ...grant, decision: 'denied' })
	).toMatchObject({ status: 'held' });
	expect(await service.claim(sampleId, sampleToken, { ...grant, token: 'other' })).toMatchObject({
		status: 'held'
	});
	expect(await service.claim(sampleId, sampleToken, { ...grant, node: 'mb2' })).toMatchObject({
		status: 'held'
	});
	conditions.due = { enabled: true, paused: false, localDue: true, hubAllowsLocal: false };
	expect(await service.claim(sampleId, sampleToken, grant)).toMatchObject({ status: 'held' });
	expect(runs()).toEqual([]);
	conditions.due.hubAllowsLocal = true;
	expect(await service.claim(sampleId, sampleToken, grant)).toMatchObject({ status: 'start' });
});

test('due claim rechecks policy, item and admission even after receiving a grant', async () => {
	const policy = { enabled: true, paused: false, localDue: true };
	const {
		service,
		changeItem,
		conditions,
		policy: hooks,
		runs
	} = dispatcherFixture({ due: policy });
	await service.request(sampleId, { source: 'due', token: sampleToken });
	const grant = { node: primary, token: sampleToken, decision: 'granted' } as const;
	conditions.due = { ...policy, paused: true };
	expect(await service.claim(sampleId, sampleToken, grant)).toMatchObject({ status: 'held' });
	conditions.due = policy;
	for (const patch of [
		{ scheduleOff: true },
		{ awaitingAnswer: true },
		{ agent: 'personal-research' }
	]) {
		changeItem({ scheduleOff: false, awaitingAnswer: false, agent: null, ...patch });
		expect(await service.claim(sampleId, sampleToken, grant)).toMatchObject({ status: 'held' });
	}
	changeItem({ agent: null });
	hooks.admit = () => 'codex quota exhausted';
	expect(await service.claim(sampleId, sampleToken, grant)).toEqual({
		status: 'held',
		reason: 'codex quota exhausted'
	});
	expect(runs()).toEqual([]);
});

test('adapter due ownership applies even when regular due scheduling is disabled', async () => {
	const { service, conditions } = dispatcherFixture({
		item: { adapterDueOwner: primary },
		due: { enabled: false, paused: false, adapterDue: true }
	});
	expect(await service.request(sampleId, { source: 'due', token: sampleToken })).toMatchObject({
		status: 'requested'
	});
	const grant = { decision: 'granted', node: primary, token: sampleToken } as const;
	conditions.due = { enabled: false, paused: false, adapterDue: false };
	expect(await service.claim(sampleId, sampleToken, grant)).toMatchObject({ status: 'held' });
	conditions.due.adapterDue = true;
	expect(await service.claim(sampleId, sampleToken, grant)).toMatchObject({ status: 'start' });
});

test('the hub paces due reservations across items and can claim at the exact interval', async () => {
	const { service, changeItem, advance } = dispatcherFixture({
		due: { enabled: true, paused: false },
		policy: { hub: true }
	});
	await service.request(sampleId, { source: 'due', token: sampleToken });
	changeItem({ id: 'other-item', launch: null });
	await service.request('other-item', { source: 'due', token: 'other-token' });
	expect(await service.claim(sampleId, sampleToken)).toMatchObject({ status: 'start' });
	expect(await service.claim('other-item', 'other-token')).toEqual({
		status: 'held',
		reason: 'due launch interval has not elapsed'
	});
	advance(15_000);
	expect(await service.claim('other-item', 'other-token')).toMatchObject({
		status: 'start',
		run: { id: 2 }
	});
});
