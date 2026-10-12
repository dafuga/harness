import { expect, test } from 'vitest';
import { relayError, relayResponse } from '../../src/utils/relayResponse';

test('relayResponse answers JSON that is neither cached nor sniffed', async () => {
	const response = relayResponse(202, { state: 'requested' });
	expect(response.status).toBe(202);
	expect(response.headers.get('Content-Type')).toBe('application/json');
	expect(response.headers.get('Cache-Control')).toBe('no-store');
	expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
	expect(await response.json()).toEqual({ state: 'requested' });
});

test('relayError answers a failure as its code and nothing else', async () => {
	const response = relayError(404, 'not-found');
	expect(response.status).toBe(404);
	expect(response.headers.get('Cache-Control')).toBe('no-store');
	expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
	expect(await response.json()).toEqual({ error: 'not-found' });
});
