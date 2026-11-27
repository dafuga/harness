import { expect, test } from 'vitest';
import {
	dispatcherFixture,
	sampleId,
	sampleToken,
	started
} from '../../support/trackerDispatcherFixture';

test('rewrites a queued, unstarted gpt-6.1-sol run to gpt-6.2-sol before it starts', async () => {
	const fixture = dispatcherFixture({
		policy: {
			pickModel: () => ({
				rung: { id: 'sol', cli: 'codex', model: 'gpt-6.1-sol', effort: 'high' },
				kind: 'coding',
				reason: 'queued before the model change'
			})
		}
	});
	await fixture.service.request(sampleId, { source: 'manual', token: sampleToken });
	const start = started(await fixture.service.claim(sampleId, sampleToken));
	expect(start.selection).toMatchObject({ model: 'gpt-6.2-sol', intelligence: 'high' });
	expect(fixture.runs()).toMatchObject([{ model: 'gpt-6.2-sol' }]);
});
