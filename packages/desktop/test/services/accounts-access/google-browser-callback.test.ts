import { expect, test } from 'vitest';
import { GoogleBrowserCallbackService } from '../../../src/services/accounts-access/GoogleBrowserCallbackService';

test('the loopback callback accepts one matching state and cleans the browser address', async () => {
	const callback = new GoogleBrowserCallbackService();
	const port = await callback.listen();
	callback.expect('harness-test-state');
	const origin = `http://127.0.0.1:${port}`;
	const code = 'x'.repeat(43);
	try {
		const denied = await fetch(`${origin}/harness-account?state=another&code=${code}`);
		expect(denied.status).toBe(400);
		expect(callback.take()).toBeUndefined();
		const result = await fetch(`${origin}/harness-account?state=harness-test-state&code=${code}`);
		expect(result.url).toBe(`${origin}/return-to-harness`);
		expect(await result.text()).toBe('Return to Harness to finish signing in.');
		expect(callback.take()).toBe(code);
		expect(callback.take()).toBeUndefined();
	} finally {
		callback.close();
	}
});
