import { expect, test } from 'vitest';
import { HubResponsesMiddleware } from '../../src/middleware/HubResponsesMiddleware';

test('native approval and project responses deny frames without disabling Google sign-in', () => {
	const response = new HubResponsesMiddleware().handle(new Response('<h1>Approve</h1>'));
	expect(response.headers.get('X-Frame-Options')).toBe('DENY');
	expect(response.headers.get('Content-Security-Policy')).toBe("frame-ancestors 'none'");
	expect(response.headers.get('Cache-Control')).toBe('private, no-store');
	expect(response.headers.get('Referrer-Policy')).toBe('no-referrer');
});
