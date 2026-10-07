import { expect, test } from 'vitest';
import { gatewayReplay } from '../../src/utils/gatewayReplay';
test('retry key distinguishes history and tool definitions', () => {
	const request = { model: 'claude-opus-5-5', stream: true as const, input: [], tools: [] };
	expect(gatewayReplay(request)).toBe(gatewayReplay({ ...request }));
	expect(gatewayReplay(request)).not.toBe(
		gatewayReplay({ ...request, input: [{ role: 'user', content: 'next' }] })
	);
});
