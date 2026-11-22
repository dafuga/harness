import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { ActivePreviewLeaseError } from '../../src/adapters/agents-providers/ActivePreviewLeaseError';
import { DecartAdapter, renderRate, validateSession } from '../../src/adapters/agents-providers/DecartAdapter';
import type { TokenClient } from '../../src/adapters/agents-providers/DecartAdapter.types';
import { DecartTokenCreationError } from '../../src/adapters/agents-providers/DecartTokenCreationError';
import { InvalidPreviewRequestError } from '../../src/adapters/agents-providers/InvalidPreviewRequestError';

const validRequest = {
	model: 'lucy-2.5' as const,
	fast: true,
	seconds: 30,
	projectId: 'project-demo-01'
};

test('prices the supported Decart render models', () => {
	const outputs = [renderRate('lucy-restyle-2', false), renderRate('lucy-2.5', false), renderRate('lucy-2.5', true)];
	expect(outputs).toEqual([0.01, 0.02, 0.04]);
	recordExampleCases(
		{
			unitId: 'game.adapter.decart',
			symbol: 'renderRate',
			state: 'prices-the-supported-decart-render-models',
			evidence: 'examples-cases',
			file: 'prices-the-supported-decart-render-models.json'
		},
		[
			{ name: 'restyle uses its fixed rate', input: { model: 'lucy-restyle-2', fast: false }, output: 0.01 },
			{ name: 'standard Lucy uses the standard rate', input: { model: 'lucy-2.5', fast: false }, output: 0.02 },
			{ name: 'fast Lucy uses the fast rate', input: { model: 'lucy-2.5', fast: true }, output: 0.04 }
		]
	);
});

test('validates preview model and duration requests', () => {
	const output = validateSession(validRequest);
	expect(output).toBeUndefined();
	recordExampleCases(
		{
			unitId: 'game.adapter.decart',
			symbol: 'validateSession',
			state: 'validates-preview-model-and-duration-requests',
			evidence: 'examples-cases',
			file: 'validates-preview-model-and-duration-requests.json'
		},
		[{ name: 'accepts a fast thirty second Lucy preview', input: validRequest, output: null }]
	);
});

test('starts a preview with a minted token and request metadata', async () => {
	let tokenRequest: Parameters<TokenClient['create']>[0] | undefined;
	const tokens = {
		create: async (request: Parameters<TokenClient['create']>[0]) => {
			tokenRequest = request;
			return { apiKey: 'example-preview-key-01', expiresAt: '2026-11-15T12:01:00.000Z' };
		}
	} as Pick<TokenClient, 'create'>;
	const adapter = new DecartAdapter(tokens, () => Date.parse('2026-11-15T12:00:00.000Z'));
	const output = await adapter.start(validRequest);
	expect(output).toEqual({
		apiKey: 'example-preview-key-01',
		expiresAt: '2026-11-15T12:01:00.000Z',
		model: 'lucy-2.5',
		fast: true,
		seconds: 30,
		rate: 0.04
	});
	expect(tokenRequest).toEqual({
		expiresIn: 60,
		allowedModels: ['lucy-2.5'],
		constraints: { realtime: { maxSessionDuration: 30 } },
		metadata: { projectId: 'project-demo-01' }
	});
	recordExampleCases(
		{
			unitId: 'game.adapter.decart',
			symbol: 'DecartAdapter.start',
			state: 'starts-a-preview-with-a-minted-token-and-request-metadata',
			evidence: 'examples-cases',
			file: 'starts-a-preview-with-a-minted-token-and-request-metadata.json'
		},
		[
			{
				name: 'returns the session details from the request and minted token',
				input: { request: validRequest, tokenRequest },
				output
			}
		]
	);
});

test('Throws InvalidPreviewRequestError when the model is unsupported', async () => {
	const tokens = { create: async () => ({ apiKey: 'unused', expiresAt: 'unused' }) } as Pick<TokenClient, 'create'>;
	const adapter = new DecartAdapter(tokens, () => 0);
	const request = { ...validRequest, model: 'unknown' } as unknown as typeof validRequest;
	await expect(adapter.start(request)).rejects.toBeInstanceOf(InvalidPreviewRequestError);
	const failure = { name: 'InvalidPreviewRequestError', message: 'Invalid AI preview. Choose a supported model and 10–60 seconds.' };
	recordExampleCases({ unitId: 'game.adapter.decart', symbol: 'DecartAdapter.start', state: 'throws-invalidpreviewrequesterror-when-the-model-is-unsuppor', evidence: 'examples-cases', file: 'throws-invalidpreviewrequesterror-when-the-model-is-unsuppor.json' }, [
		{ name: 'rejects an unsupported model before token creation', input: { request }, error: failure }
	]);
});

test('Throws ActivePreviewLeaseError when a preview lease is already active', async () => {
	const tokens = { create: async () => ({ apiKey: 'example-key', expiresAt: '2026-11-15T12:01:00.000Z' }) } as Pick<TokenClient, 'create'>;
	const adapter = new DecartAdapter(tokens, () => Date.parse('2026-11-15T12:00:00.000Z'));
	await adapter.start(validRequest);
	await expect(adapter.start(validRequest)).rejects.toBeInstanceOf(ActivePreviewLeaseError);
	const failure = { name: 'ActivePreviewLeaseError', message: 'An AI preview lease is already active.' };
	recordExampleCases({ unitId: 'game.adapter.decart', symbol: 'DecartAdapter.start', state: 'throws-activepreviewleaseerror-when-a-preview-lease-is-alrea', evidence: 'examples-cases', file: 'throws-activepreviewleaseerror-when-a-preview-lease-is-alrea.json' }, [
		{ name: 'rejects a second preview while the first lease remains active', input: { request: validRequest, starts: 2 }, error: failure }
	]);
});

test('Throws DecartTokenCreationError when token creation fails', async () => {
	const tokens = { create: async () => { throw new Error('provider detail'); } } as Pick<TokenClient, 'create'>;
	const adapter = new DecartAdapter(tokens, () => 0);
	await expect(adapter.start(validRequest)).rejects.toBeInstanceOf(DecartTokenCreationError);
	const failure = { name: 'DecartTokenCreationError', message: 'Unable to start the Decart preview. Check this project’s provider configuration.' };
	recordExampleCases({ unitId: 'game.adapter.decart', symbol: 'DecartAdapter.start', state: 'throws-decarttokencreationerror-when-token-creation-fails', evidence: 'examples-cases', file: 'throws-decarttokencreationerror-when-token-creation-fails.json' }, [
		{ name: 'discards the provider error and reports token creation failure', input: { request: validRequest }, error: failure }
	]);
});
