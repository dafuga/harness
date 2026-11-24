import { expect, test } from 'vitest';
import type { TrackerItem } from '../../../src/repositories/projects-sessions/TrackerItemReadRepository.types';
import type { TrackerListedRun } from '../../../src/repositories/projects-sessions/TrackerRunReadRepository.types';
import {
	launchLiveNotStopped,
	launchRequestStatus,
	launchWithdrawnReason
} from '../../../src/services/projects-sessions/tracker-local-api-service/launchRequestStatus';

const token = 'launch-token-1';

function item(fields: Partial<TrackerItem> = {}): TrackerItem {
	return {
		id: 'item-1',
		computer: 'mb2',
		launch_target: 'mb2',
		auto: token,
		launch_hold: null,
		...fields
	} as unknown as TrackerItem;
}

function run(fields: Partial<TrackerListedRun>): TrackerListedRun {
	return {
		id: 1,
		node: 'mb2',
		attempt: 1,
		auto_token: token,
		state: 'queued',
		outcome: null,
		started_at: null,
		failure_reason: null,
		...fields
	} as unknown as TrackerListedRun;
}

test('an item with a queued run reports queued, and waiting once a hold reason is persisted', () => {
	const queued = run({ state: 'queued' });
	expect(launchRequestStatus(item(), [queued])).toEqual({
		status: 'queued',
		computer: 'mb2',
		attempt: 1
	});
	const hold = JSON.stringify({ reason: 'item already has an open session', at: 1 });
	expect(launchRequestStatus(item({ launch_hold: hold }), [queued])).toEqual({
		status: 'waiting',
		reason: 'item already has an open session',
		computer: 'mb2',
		attempt: 1
	});
});

test('a request whose token has no run yet is queued, not refused', () => {
	expect(launchRequestStatus(item(), [])).toEqual({ status: 'queued', computer: 'mb2' });
});

test('a running attempt reports started', () => {
	const running = run({ state: 'running', started_at: 10 });
	expect(launchRequestStatus(item(), [running])).toMatchObject({
		status: 'started',
		computer: 'mb2',
		attempt: 1
	});
});

test('clearing auto-launch on an unstarted request reports withdrawn', () => {
	const cancelled = run({
		state: 'finished',
		outcome: 'abandoned',
		failure_reason: launchWithdrawnReason
	});
	expect(launchRequestStatus(item({ auto: null }), [cancelled])).toEqual({
		status: 'withdrawn',
		reason: launchWithdrawnReason,
		attempt: 1
	});
});

test('clearing auto-launch while a run is live reports it as started and says it is not stopped', () => {
	const live = run({ state: 'running', started_at: 10 });
	expect(launchRequestStatus(item({ auto: null }), [live])).toMatchObject({
		status: 'started',
		reason: launchLiveNotStopped
	});
});

test('an abandoned attempt on a live request reports refused with its reason', () => {
	const refused = run({
		state: 'finished',
		outcome: 'abandoned',
		failure_reason: 'no model admits this item'
	});
	expect(launchRequestStatus(item(), [refused])).toEqual({
		status: 'refused',
		reason: 'no model admits this item',
		computer: 'mb2',
		attempt: 1
	});
});

test('an item without a request and without a withdrawn attempt has no launch status', () => {
	expect(launchRequestStatus(item({ auto: null }), [])).toBeNull();
	expect(
		launchRequestStatus(item({ auto: null }), [run({ state: 'finished', outcome: 'done' })])
	).toBeNull();
});
