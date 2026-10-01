import { afterEach, expect, test, vi } from 'vitest';
import { JevAdapter } from '../../src/adapters/JevAdapter';
import { cleanCodeQuestions } from '../../src/audit/cleanCodeRubric';
import { fixtureEvaluation } from '../support/cleanCodeFixture';

const request = { state: 'synthetic code', questions: cleanCodeQuestions() };
const config = { apiKey: 'synthetic-harness-key', model: 'jev-1.13.0', maxRetries: 0 };
const success = () => new globalThis.Response(JSON.stringify(fixtureEvaluation(request)));
afterEach(() => vi.unstubAllEnvs());

test('SDK uses the explicit official endpoint, dedicated key, and pinned model', async () => {
	vi.stubEnv('TYPESAFE_BASE_URL', 'https://invalid.example');
	vi.stubEnv('TYPESAFE_DEFAULT_MODEL', 'jev-latest');
	let url = '';
	let authorization: string | null = null;
	let model = '';
	const adapter = new JevAdapter({
		...config,
		fetch: async (input, init) => {
			url = String(input);
			authorization = new globalThis.Headers(init?.headers).get('Authorization');
			model = (JSON.parse(String(init?.body)) as { model: string }).model;
			return success();
		}
	});
	expect((await adapter.evaluate(request)).model).toBe(config.model);
	expect(url).toBe('https://api.typesafe.ai/v1/systemone');
	expect(authorization).toBe(`Bearer ${config.apiKey}`);
	expect(model).toBe(config.model);
});

test('authentication failures are not retried or allowed to expose response bodies', async () => {
	let calls = 0;
	const adapter = new JevAdapter({
		...config,
		maxRetries: 2,
		fetch: async () => {
			calls++;
			return new globalThis.Response(`${config.apiKey}: private code`, { status: 401 });
		}
	});
	await expect(adapter.evaluate(request)).rejects.toThrow('Jev request failed (HTTP 401).');
	expect(calls).toBe(1);
});

test('transient rate limits use the bounded SDK retry', async () => {
	let calls = 0;
	const adapter = new JevAdapter({
		...config,
		maxRetries: 1,
		fetch: async () => {
			calls++;
			return calls === 1
				? new globalThis.Response('{}', { status: 429, headers: { 'retry-after-ms': '1' } })
				: success();
		}
	});
	await expect(adapter.evaluate(request)).resolves.toHaveProperty('model', config.model);
	expect(calls).toBe(2);
});

test.each(['malformed', 'wrong-model'])(
	'rejects %s responses without leaking their contents',
	async (scenario) => {
		const body =
			scenario === 'malformed'
				? { secret: config.apiKey }
				: { ...fixtureEvaluation(request), model: 'jev-1.12.0' };
		const adapter = new JevAdapter({
			...config,
			fetch: async () => new globalThis.Response(JSON.stringify(body))
		});
		await expect(adapter.evaluate(request)).rejects.toThrow(
			'Jev request or response validation failed.'
		);
	}
);

test('an already cancelled request makes no API call', async () => {
	let calls = 0;
	const controller = new AbortController();
	controller.abort();
	const adapter = new JevAdapter({
		...config,
		fetch: async () => {
			calls++;
			return success();
		}
	});
	await expect(adapter.evaluate(request, controller.signal)).rejects.toThrow(
		'cancelled or timed out'
	);
	expect(calls).toBe(0);
});
