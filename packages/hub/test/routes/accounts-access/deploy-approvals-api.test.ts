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
