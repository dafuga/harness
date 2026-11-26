import { test } from 'vitest';
import { expect } from '../../verificationExpect';
import {
	dispatcherFixture,
	recorded,
	runFixture,
	sampleId
} from '../../support/trackerDispatcherFixture';

test('a failed verification or rejection reopens the item even when no retry follows', async () => {
	for (const hold of [{ launch: null }, { parkedUntil: Date.parse('2027-01-01') }]) {
		const fixture = dispatcherFixture();
		const { run } = await runFixture(fixture);
		fixture.changeItem({ status: 'done' });
		const verifying = recorded(
			await fixture.service.record(sampleId, run, {
				type: 'monitor',
				session: 'live',
				verify: true
			})
		).run;
		fixture.changeItem(hold);
		const failed = recorded(
			await fixture.service.record(sampleId, verifying, { type: 'verified', passed: false })
		);
		expect(failed.retry).toBeUndefined();
		expect(fixture.item()?.status).toBe('open');
	}
	const fixture = dispatcherFixture();
	const { run } = await runFixture(fixture);
	fixture.changeItem({ status: 'done' });
	const done = recorded(
		await fixture.service.record(sampleId, run, { type: 'monitor', session: 'live' })
	).run;
	fixture.changeItem({ launch: null });
	const rejected = recorded(
		await fixture.service.record(sampleId, done, { type: 'reject', reason: 'wrong approach' })
	);
	expect(rejected.run).toMatchObject({ outcome: 'rejected', failure_reason: 'wrong approach' });
	expect(rejected.retry).toBeUndefined();
	expect(fixture.item()?.status).toBe('open');
});
