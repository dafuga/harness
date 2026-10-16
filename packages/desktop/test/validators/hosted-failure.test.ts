import { test, expect } from 'vitest';
import { HostedFailureValidator } from '../../src/validators/HostedFailureValidator';
test('only connection failures permit offline fallback; redirects and HTTP failures never do', () => {
	const classify = HostedFailureValidator.classify;
	expect(
		classify(new TypeError('fetch failed', { cause: { code: 'ECONNREFUSED' } })).category
	).toBe('offline');
	expect(classify(new TypeError('redirect refused')).category).toBe('failed');
	expect(classify(new HostedFailureValidator('denied', 403)).status).toBe(403);
	expect(classify(new HostedFailureValidator('failed', 500)).category).toBe('failed');
});
