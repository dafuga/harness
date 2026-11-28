import { test } from 'vitest';
import { expect } from '../../verificationExpect';
import { measureWorkload } from '../../support/measureWorkload';
import { readWatchdogAlerts } from '../../../src/services/projects-sessions/tracker-native-runtime-service/trackerHostWatchdogState';
import {
	finishBatchWindow,
	launchEventFixture,
	type LaunchEventFixture
} from '../../support/trackerLaunchEventFixture';

test('records every launch transition and announces them in one batch', () =>
	measureWorkload('repository.projects-sessions-tracker-dispatch', 'launch-event-lifecycle', () =>
		proveAnnouncedLifecycle()
	));

async function proveAnnouncedLifecycle() {
	const fixture = launchEventFixture();
	fixture.add('done000001');
	await fixture.tick();
	fixture.item('done000001', { status: 'done' });
	await fixture.tick();
	fixture.add('asks000001');
	await fixture.tick();
	fixture.item('asks000001', {
		status: 'blocked',
		blocked_reason: 'needs a key',
		needs_daniel: 1,
		question: 'Which key?',
		resolved: 0
	});
	await fixture.tick();
	expect(fixture.recorded()).toEqual([
		['launched', 'done000001'],
		['done', 'done000001'],
		['launched', 'asks000001'],
		['blocked', 'asks000001']
	]);
	await proveBatch(fixture);
}

async function proveBatch(fixture: LaunchEventFixture) {
	await fixture.notify();
	expect(fixture.sent).toEqual([]);
	expect(fixture.pending()).toBe(4);
	finishBatchWindow(fixture);
	await fixture.notify();
	await fixture.notify();
	expect(fixture.sent).toHaveLength(1);
	expect(fixture.sent[0]).toMatchObject({
		event: 'autolaunch',
		title: 'Auto-launch: 4 updates',
		events: [
			{ kind: 'launched', item_id: 'done000001', run_id: 1 },
			{ kind: 'done', text: '[done00] done000001: done on haiku' },
			{ kind: 'launched', item_id: 'asks000001' },
			{
				kind: 'blocked',
				text: '[asks00] asks000001: haiku session blocked on Daniel: needs a key'
			}
		]
	});
	expect(fixture.pending()).toBe(0);
}

test('records failures, the retry, giving up and a refused model pick', async () => {
	const fixture = launchEventFixture();
	fixture.add('fails00001');
	await fixture.tick();
	fixture.exit('fails00001');
	for (let round = 0; round < 3; round++) await fixture.tick();
	fixture.add('nopick0001', { model: 'unknown' });
	await fixture.tick();
	expect(fixture.recorded()).toEqual([
		['launched', 'fails00001'],
		['failed', 'fails00001'],
		['escalated', 'fails00001'],
		['launched', 'fails00001'],
		['failed', 'fails00001'],
		['gave_up', 'fails00001'],
		['launch_failed', 'nopick0001']
	]);
	await proveManualStartupRetry(1);
	await proveManualStartupRetry(2);
});

async function proveManualStartupRetry(failures: number) {
	const fixture = launchEventFixture();
	const id = 'startup001';
	const cause = 'Git worktree add: Tracker host command did not complete';
	fixture.state.startupFailures.set(id, failures);
	fixture.add(id, {
		launch_source: 'manual',
		schedule_off: 1,
		'note+': 'auto-launch requested on daniel-primary-mbp'
	});
	await fixture.tick();
	await fixture.tick();
	const pending = await fixture.show(id);
	expect(pending.runs).toMatchObject([
		{ attempt: 1, state: 'queued', failure_reason: cause, started_at: null }
	]);
	expect(readWatchdogAlerts(fixture.runtime.store)).toEqual({});
	for (let attempt = 0; attempt < failures; attempt++) {
		fixture.state.at += 5 * 60_000;
		await fixture.tick();
		await fixture.tick();
	}
	const item = await fixture.show(id);
	expect(item.schedule_off).toBe(true);
	expect(item.runs, 'explicit startup retry must survive scheduling opt-out').toMatchObject([
		{ attempt: 1, outcome: 'abandoned', failure_reason: `launch expired before startup: ${cause}` },
		{ attempt: 2, state: failures === 1 ? 'running' : 'finished', auto_token: pending.auto }
	]);
	if (failures === 1) {
		expect(readWatchdogAlerts(fixture.runtime.store)).toEqual({});
		return;
	}
	expect(item.status).toBe('blocked');
	expect(Object.values(readWatchdogAlerts(fixture.runtime.store))).toMatchObject([
		{ kind: 'launch-startup-failed', item_id: id, reason: expect.stringContaining(cause) }
	]);
	await fixture.tick();
	expect((await fixture.show(id)).runs).toHaveLength(2);
	expect(Object.values(readWatchdogAlerts(fixture.runtime.store))).toHaveLength(1);
}

test('notes a due request and says why each request is still waiting', async () => {
	const fixture = launchEventFixture({ scheduleDue: true });
	fixture.add('due0000001', { auto: undefined, due: '2026-11-20' });
	await fixture.tick();
	expect(fixture.notes('due0000001')).toContain(
		'due scheduler requested launch on daniel-primary-mbp (claude-haiku-5-5:high)'
	);
	fixture.add('held000001');
	fixture.add('asked00001', { needs_daniel: 1, question: 'Hold?' });
	await fixture.tick();
	await expect(fixture.show('held000001')).resolves.toMatchObject({
		launch_status: { computer: 'daniel-primary-mbp', reason: 'no approved repository' }
	});
	await expect(fixture.show('asked00001')).resolves.toMatchObject({
		launch_status: { reason: 'waiting on Daniel' }
	});
	expect(fixture.requests()).toMatchObject({
		skipped: expect.arrayContaining([
			expect.objectContaining({ id: 'held000001', reason: 'no approved repository' }),
			expect.objectContaining({ id: 'asked00001', reason: 'waiting on Daniel' })
		])
	});
});
