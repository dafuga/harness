import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { ApiSessionRepository } from '../../src/services/networking-security/harness-api-service/ApiSessionRepository';

test('Loads a saved token for its exact origin', async () => {
	await withTempDir('api-session-load-', async (directory) => {
		const repository = new ApiSessionRepository('https://harness.example.com', directory);
		await repository.save('4c7e1f09b2a8d3e6f5a1c0b9d8e7f6a5');
		const output = await repository.load();
		expect(output).toBe('4c7e1f09b2a8d3e6f5a1c0b9d8e7f6a5');
		recordExampleCases(
			{
				unitId: 'service.networking-security-harness-api-service-api-session-repository',
				symbol: 'load',
				state: 'loads-a-saved-token-for-its-exact-origin',
				evidence: 'examples-cases',
				file: 'loads-a-saved-token-for-its-exact-origin.json'
			},
			[
				{
					name: 'saved token is returned',
					input: {
						origin: 'https://harness.example.com',
						token: '4c7e1f09b2a8d3e6f5a1c0b9d8e7f6a5'
					},
					output
				}
			]
		);
	});
});

test('Creates and saves a token when no session exists', async () => {
	await withTempDir('api-session-ensure-', async (directory) => {
		const repository = new ApiSessionRepository('http://127.0.0.1:8080', directory);
		let calls = 0;
		const output = await repository.ensure(async () => {
			calls++;
			return '9f2b6d1a7e4c8b03f5d2a9e1c7b4f608';
		});
		expect(output).toBe('9f2b6d1a7e4c8b03f5d2a9e1c7b4f608');
		expect(calls).toBe(1);
		recordExampleCases(
			{
				unitId: 'service.networking-security-harness-api-service-api-session-repository',
				symbol: 'ensure',
				state: 'creates-and-saves-a-token-when-no-session-exists',
				evidence: 'examples-cases',
				file: 'creates-and-saves-a-token-when-no-session-exists.json'
			},
			[
				{
					name: 'callback token is persisted',
					input: { origin: 'http://127.0.0.1:8080' },
					output: { token: output, createCalls: calls }
				}
			]
		);
	});
});

test('Reuses an existing token without creating another', async () => {
	await withTempDir('api-session-reuse-', async (directory) => {
		const repository = new ApiSessionRepository('https://harness.example.com', directory);
		await repository.save('4c7e1f09b2a8d3e6f5a1c0b9d8e7f6a5');
		let calls = 0;
		const output = await repository.ensure(async () => {
			calls++;
			return 'unused';
		});
		expect(output).toBe('4c7e1f09b2a8d3e6f5a1c0b9d8e7f6a5');
		expect(calls).toBe(0);
		recordExampleCases(
			{
				unitId: 'service.networking-security-harness-api-service-api-session-repository',
				symbol: 'ensure',
				state: 'reuses-an-existing-token-without-creating-another',
				evidence: 'examples-cases',
				file: 'reuses-an-existing-token-without-creating-another.json'
			},
			[
				{
					name: 'existing token is reused',
					input: { token: '4c7e1f09b2a8d3e6f5a1c0b9d8e7f6a5' },
					output: { token: output, createCalls: calls }
				}
			]
		);
	});
});

test('Forgets a saved session and tolerates an absent session', async () => {
	await withTempDir('api-session-forget-', async (directory) => {
		const repository = new ApiSessionRepository('https://harness.example.com', directory);
		await repository.save('4c7e1f09b2a8d3e6f5a1c0b9d8e7f6a5');
		await repository.forget();
		const output = await repository.load();
		expect(output).toBeUndefined();
		await repository.forget();
		recordExampleCases(
			{
				unitId: 'service.networking-security-harness-api-service-api-session-repository',
				symbol: 'forget',
				state: 'forgets-a-saved-session-and-tolerates-an-absent-session',
				evidence: 'examples-cases',
				file: 'forgets-a-saved-session-and-tolerates-an-absent-session.json'
			},
			[
				{
					name: 'removed session loads as absent',
					input: { token: '4c7e1f09b2a8d3e6f5a1c0b9d8e7f6a5' },
					output: null
				}
			]
		);
	});
});
