import { test } from 'vitest';
import { expect } from '../../verificationExpect';
import { dispatchJournalFields } from '../../../src/repositories/projects-sessions/tracker-dispatch-repository/dispatchItemFields';
import {
	dispatcherFixture,
	sampleId,
	sampleToken,
	started
} from '../../support/trackerDispatcherFixture';

test('a queued request keeps the reason it is waiting and rewrites it only when the reason changes', async () => {
	const fixture = dispatcherFixture();
	const { conditions, service, store, advance } = fixture;
	await service.request(sampleId, { source: 'manual', token: sampleToken });
	conditions.openSession = true;
	const reason = 'item already has an open session';
	expect(await service.claim(sampleId, sampleToken)).toEqual({ status: 'held', reason });
	const first = store.item(sampleId)!.launch!.hold;
	expect(first).toEqual({ reason, at: expect.any(Number) });

	advance(60_000);
	expect(await service.claim(sampleId, sampleToken)).toEqual({ status: 'held', reason });
	expect(store.item(sampleId)!.launch!.hold).toEqual(first);
});

test('a reserved start clears the hold and the held state is not left on a started request', async () => {
	const fixture = dispatcherFixture();
	const { conditions, service, store } = fixture;
	await service.request(sampleId, { source: 'manual', token: sampleToken });
	conditions.openSession = true;
	await service.claim(sampleId, sampleToken);
	expect(store.item(sampleId)!.launch!.hold).toBeDefined();

	conditions.openSession = false;
	expect(started(await service.claim(sampleId, sampleToken)).status).toBe('start');
	expect(store.item(sampleId)!.launch).toEqual(
		expect.objectContaining({ token: sampleToken, source: 'manual' })
	);
	expect(store.item(sampleId)!.launch!.hold).toBeUndefined();
});

test('a new request writes no hold and the journal stores the hold as its own field', () => {
	const hold = { reason: 'launcher disabled', at: 1_700_000_000_000 };
	const fields = dispatchJournalFields({
		launch: { token: sampleToken, source: 'manual', target: 'daniel-primary-mbp', hold }
	});
	expect(fields).toMatchObject({
		auto: sampleToken,
		launch_hold: JSON.stringify(hold)
	});
	expect(
		dispatchJournalFields({ launch: { token: sampleToken, source: 'manual', target: null } })
	).toMatchObject({ launch_hold: null });
});
