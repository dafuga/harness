import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { CodexGatewayService } from '../../src/cli/program/codex-gateway-service/CodexGatewayService';

test('Reports gateway health for an authorized request', async () => {
	const token = 'a41d7e0c9b3f5a682d1e4c7b0f9a3d6e8c2b5f1a7d4e0c9b3f6a2d8e1c5b7f04';
	const service = new CodexGatewayService({ token });
	const response = await service.fetch(new Request('http://gateway.test/healthz', {
		headers: { authorization: `Bearer ${token}` }
	}));
	const output = await response.json();
	expect(response.status).toBe(200);
	expect(output).toMatchObject({ status: 'ok', prototype: true });
	recordExampleCases({
		unitId: 'service.codex-gateway',
		symbol: 'fetch',
		state: 'reports-gateway-health-for-an-authorized-request',
		evidence: 'examples-cases',
		file: 'reports-gateway-health-for-an-authorized-request.json'
	}, [{
		name: 'authorized health request returns the prototype health report',
		input: { method: 'GET', path: '/healthz', authorization: `Bearer ${token}` },
		output: { status: response.status, body: output }
	}]);
});

test('Rejects requests from browser origins', async () => {
	const token = 'Qm8xYv3RzT1kLp9WsE4hNc7UjD2gFa5I';
	const response = await new CodexGatewayService({ token }).fetch(new Request('http://gateway.test/healthz', {
		headers: { authorization: `Bearer ${token}`, origin: 'https://app.example.test' }
	}));
	const output = await response.json();
	expect(response.status).toBe(403);
	recordExampleCases({
		unitId: 'service.codex-gateway',
		symbol: 'fetch',
		state: 'rejects-requests-from-browser-origins',
		evidence: 'examples-cases',
		file: 'rejects-requests-from-browser-origins.json'
	}, [{
		name: 'non-empty origin is rejected before routing',
		input: { path: '/healthz', origin: 'https://app.example.test' },
		output: { status: response.status, body: output }
	}]);
});

test('Rejects an invalid bearer token', async () => {
	const response = await new CodexGatewayService({ token: 'Qm8xYv3RzT1kLp9WsE4hNc7UjD2gFa5I' }).fetch(
		new Request('http://gateway.test/healthz', { headers: { authorization: 'Bearer incorrect' } })
	);
	const output = await response.json();
	expect(response.status).toBe(401);
	recordExampleCases({
		unitId: 'service.codex-gateway',
		symbol: 'fetch',
		state: 'rejects-an-invalid-bearer-token',
		evidence: 'examples-cases',
		file: 'rejects-an-invalid-bearer-token.json'
	}, [{
		name: 'mismatched bearer token returns unauthorized',
		input: { path: '/healthz', authorization: 'Bearer incorrect' },
		output: { status: response.status, body: output }
	}]);
});
