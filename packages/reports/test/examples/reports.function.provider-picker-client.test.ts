import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { providerPickerClient } from '../../src/components/agents-providers/provider-picker/providerPickerClient';
import type { PickerClient } from '../../src/utils/agents-providers/providerPickerClient';

const snapshot = {
	sessionId: 'fixture-session',
	defaultProvider: 'openai' as const,
	active: null,
	request: null,
	models: [],
	controlConnected: true,
	message: 'Ready'
};

function enablePreview(): void {
	Object.defineProperty(globalThis, 'document', {
		configurable: true,
		value: { body: { dataset: { pickerPreview: 'true' } } }
	});
	Object.defineProperty(globalThis, 'window', {
		configurable: true,
		value: { parent: undefined }
	});
	const previewWindow = (globalThis as { window: { parent?: unknown } }).window;
	previewWindow.parent = previewWindow;
}

test('Preview initializes with a snapshot and calls tools', async () => {
	enablePreview();
	const requests: unknown[] = [];
	Object.defineProperty(globalThis, 'fetch', { configurable: true, value: async (_input: URL | RequestInfo, init?: RequestInit) => {
		requests.push(JSON.parse(String(init?.body)));
		return { ok: true, json: async () => snapshot } as Response;
	} });
	let received: unknown;
	const client: PickerClient = await providerPickerClient((data) => { received = data; });
	const result = await client.call('list_models', { provider: 'openai' });
	await client.close();
	const output = { preview: client.preview, received, result, requests };
	expect(output).toEqual({
		preview: true,
		received: snapshot,
		result: snapshot,
		requests: [
			{ name: 'open_model_picker', arguments: {} },
			{ name: 'list_models', arguments: { provider: 'openai' } }
		]
	});
	recordExampleCases(
		{
			unitId: 'reports.function.provider-picker-client',
			symbol: 'providerPickerClient',
			state: 'preview-initializes-with-a-snapshot-and-calls-tools',
			evidence: 'examples-cases',
			file: 'preview-initializes-with-a-snapshot-and-calls-tools.json'
		},
		[{ name: 'preview loads then calls a provider tool', input: { name: 'list_models', arguments: { provider: 'openai' } }, output: { preview: true, received: snapshot, result: snapshot } }]
	);
});

test('Preview rejects non-OK tool responses', async () => {
	enablePreview();
	Object.defineProperty(globalThis, 'fetch', {
		configurable: true,
		value: async () => ({ ok: false, json: async () => ({}) }) as Response
	});
	let message = '';
	try {
		await providerPickerClient(() => {});
	} catch (error) {
		message = error instanceof Error ? error.message : String(error);
	}
	expect(message).toBe('Preview request rejected.');
	recordExampleCases(
		{
			unitId: 'reports.function.provider-picker-client',
			symbol: 'providerPickerClient',
			state: 'preview-rejects-non-ok-tool-responses',
			evidence: 'examples-cases',
			file: 'preview-rejects-non-ok-tool-responses.json'
		},
		[{ name: 'preview endpoint rejects initialization', input: { name: 'open_model_picker' }, error: 'Preview request rejected.' }]
	);
});
