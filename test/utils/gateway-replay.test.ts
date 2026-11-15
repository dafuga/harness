import { createHash } from 'node:crypto';
import { expect, test } from 'vitest';
import { gatewayReplay } from '../../src/cli/program/codex-gateway-service/gatewayReplay';
test('retry key distinguishes history and tool definitions', () => {
	const request = { model: 'claude-opus-5-5', stream: true as const, input: [], tools: [] };
	expect(gatewayReplay(request)).toBe(gatewayReplay({ ...request }));
	expect(gatewayReplay(request)).not.toBe(
		gatewayReplay({ ...request, input: [{ role: 'user', content: 'next' }] })
	);
});
test('retry key is the SHA-256 digest of the serialized request', () => {
	const request = { model: 'claude-opus-5-5', stream: true as const, input: [], tools: [] };
	const digest = createHash('sha256').update(JSON.stringify(request)).digest('hex');
	expect(gatewayReplay(request)).toBe(digest);
});
