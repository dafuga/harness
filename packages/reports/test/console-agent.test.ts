import { expect } from '../../../test/verificationExpect';
import { test, vi } from 'vitest';
import { ConsoleAgentController } from '../src/controllers/ConsoleAgentController';
import { consoleAgent } from '../src/services/ConsoleAgentService';
vi.mock('../src/services/ConsoleAgentService', () => ({
	consoleAgent: vi.fn(async () => ({ accepted: true }))
}));
const origin = 'http://127.0.0.1:5688';
const controller = new ConsoleAgentController();
const request = (headers: Record<string, string> = {}, body = '{}') =>
	new Request(origin + '/api/agent', {
		method: 'POST',
		headers: { origin, 'content-type': 'application/json', ...headers },
		body
	});
test('owner web chat requires loopback Host, same origin and JSON before invoking its executor', async () => {
	vi.mocked(consoleAgent).mockClear();
	const refused: Record<string, string>[] = [
		{ origin: 'https://other.invalid' },
		{ 'sec-fetch-site': 'cross-site' },
		{ 'content-type': 'text/plain' }
	];
	for (const headers of refused) {
		expect((await controller.handle(request(headers))).status).toBeGreaterThanOrEqual(400);
	}
	const rebound = new Request('http://attacker.invalid/api/agent', {
		method: 'POST',
		headers: { origin: 'http://attacker.invalid', 'content-type': 'application/json' },
		body: '{}'
	});
	expect((await controller.handle(rebound)).status).toBe(403);
	expect(consoleAgent).not.toHaveBeenCalled();
	const accepted = await controller.handle(request());
	expect(accepted.status).toBe(200);
	expect(consoleAgent).toHaveBeenCalledOnce();
});
test('oversized and malformed payloads never reach the executor', async () => {
	vi.mocked(consoleAgent).mockClear();
	expect((await controller.handle(request({}, 'x'.repeat(128001)))).status).toBe(413);
	for (const body of ['[]', 'null', '{'])
		expect((await controller.handle(request({}, body))).status).toBe(400);
	expect(consoleAgent).not.toHaveBeenCalled();
});

test('native local API clients use bearer headers and receive original artifact bytes', async () => {
	vi.mocked(consoleAgent).mockClear();
	vi.mocked(consoleAgent).mockResolvedValueOnce({ accepted: true });
	const reply = await controller.handle(
		request(
			{ authorization: 'Bearer synthetic-session' },
			'{"method":"snapshot","input":{"branch":null,"commit":null}}'
		)
	);
	expect(reply.status).toBe(200);
	expect(consoleAgent).toHaveBeenLastCalledWith({
		method: 'snapshot',
		input: { branch: null, commit: null },
		token: 'synthetic-session'
	});
	const bytes = new Uint8Array([137, 80, 78, 71]);
	vi.mocked(consoleAgent).mockResolvedValueOnce({
		bytes,
		mediaType: 'image/png',
		sha256: 'a'.repeat(64)
	} as never);
	const artifact = await controller.handle(
		request({ authorization: 'Bearer synthetic-session' }, '{"method":"artifact","input":{}}')
	);
	expect(artifact.headers.get('content-type')).toBe('image/png');
	expect(new Uint8Array(await artifact.arrayBuffer())).toEqual(bytes);
});
