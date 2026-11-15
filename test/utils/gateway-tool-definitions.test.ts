import { expect, test } from 'vitest';
import { gatewayToolDefinitions } from '../../src/utils/development-tooling/gatewayToolDefinitions';
test('Codex namespace tools keep their namespace and function name', () => {
	const nested = {
		type: 'namespace',
		name: 'mcp__fixture',
		tools: [{ type: 'function', name: 'read', parameters: { type: 'object', properties: {} } }]
	};
	expect(gatewayToolDefinitions([nested])).toEqual([
		{ ...nested.tools[0], namespace: 'mcp__fixture' }
	]);
});
test('unsupported hosted tools are rejected without dropping them', () => {
	expect(() => gatewayToolDefinitions([{ type: 'web_search' }])).toThrow('Unsupported hosted');
});
test('custom tools pass through unchanged, outside any namespace', () => {
	const custom = { type: 'custom', name: 'apply_patch' };
	expect(gatewayToolDefinitions([custom])).toEqual([custom]);
});
