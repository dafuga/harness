import { expect, test } from 'vitest';
import { CodexGatewayService } from '../../src/services/CodexGatewayService';

const payload = {
	model: 'claude-opus-5-5',
	stream: true,
	input: [{ role: 'user', content: 'hello' }]
};

test('gateway refuses unauthenticated inference and non-local browser origins', async () => {
	const service = new CodexGatewayService({ token: 'synthetic-gateway-token' });
	const response = await service.fetch(
		new globalThis.Request('http://localhost/v1/responses', {
			method: 'POST',
			body: JSON.stringify(payload)
		})
	);
	expect(response.status).toBe(401);
	const browser = await service.fetch(
		new globalThis.Request('http://localhost/healthz', {
			headers: { Origin: 'https://untrusted.example' }
		})
	);
	expect(browser.status).toBe(403);
});

test('gateway rejects unsupported models before calling Claude', async () => {
	const service = new CodexGatewayService({ token: 'synthetic-gateway-token' });
	const response = await service.fetch(
		new globalThis.Request('http://localhost/v1/responses', {
			method: 'POST',
			headers: { Authorization: 'Bearer synthetic-gateway-token', 'thread-id': 'test-thread' },
			body: JSON.stringify({ ...payload, model: 'unsupported-model' })
		})
	);
	expect(response.status).toBe(400);
	expect(await response.text()).not.toContain('synthetic-gateway-token');
});
