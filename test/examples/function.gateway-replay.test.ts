import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import type { GatewayRequest } from '../../src/utils/development-tooling/gatewayTypes';
import { gatewayReplay } from '../../src/cli/program/codex-gateway-service/gatewayReplay';

test('Hashes gateway requests by serialized identity', () => {
	const request = {
		model: 'gpt-4.1',
		stream: true,
		input: [{ role: 'user', content: 'Summarize this document.' }],
		tools: []
	} satisfies GatewayRequest;
	const reorderedRequest = {
		stream: true,
		model: 'gpt-4.1',
		input: [{ role: 'user', content: 'Summarize this document.' }],
		tools: []
	} satisfies GatewayRequest;
	const digest = gatewayReplay(request);
	const reorderedDigest = gatewayReplay(reorderedRequest);
	const cases = [
		{ name: 'standard user request', input: request, output: digest },
		{ name: 'same values in different property order', input: reorderedRequest, output: reorderedDigest }
	];

	expect(digest).toMatch(/^[a-f0-9]{64}$/);
	expect(reorderedDigest).not.toBe(digest);
	recordExampleCases(
		{
			unitId: 'function.gateway-replay',
			symbol: 'gatewayReplay',
			state: 'hashes-gateway-requests-by-serialized-identity',
			evidence: 'examples-cases',
			file: 'hashes-gateway-requests-by-serialized-identity.json'
		},
		cases
	);
});
