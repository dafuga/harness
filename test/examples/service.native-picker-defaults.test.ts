import { join } from 'node:path';
import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { NativePickerDefaultsService } from '../../src/services/development-tooling/native-picker-bridge-service/NativePickerDefaultsService';
import { InvalidConfigurationEditsError } from '../../src/services/development-tooling/native-picker-bridge-service/NativePickerDefaultsService.types';

type Call = {
	method: string;
	params: Record<string, unknown>;
	options?: Record<string, unknown>;
};

const SANDBOX_EDIT = { keyPath: 'sandbox_mode', value: 'read-only' };
const MODEL_EDIT = { keyPath: 'model', value: 'gpt-5' };

function fakeRpc(calls: Call[], config: Record<string, unknown> = {}) {
	return async (
		method: string,
		params: Record<string, unknown>,
		options?: Record<string, unknown>
	): Promise<Record<string, unknown>> => {
		calls.push({ method, params, options });
		if (method === 'config/read') return { config };
		return { status: 'written' };
	};
}

function errorSummary(error: unknown): { name: string; message: string } {
	return { name: (error as Error).name, message: (error as Error).message };
}

test('Rejects write when edits is not an array', async () => {
	const calls: Call[] = [];
	const service = new NativePickerDefaultsService(fakeRpc(calls));
	const input = { edits: 'sandbox_mode' };
	let error: unknown;
	try {
		await service.write(input);
	} catch (caught) {
		error = caught;
	}

	expect(error).toBeInstanceOf(InvalidConfigurationEditsError);
	expect((error as Error).message).toBe('Invalid configuration edits');
	expect(calls).toHaveLength(0);
	recordExampleCases(
		{
			unitId: 'service.native-picker-defaults',
			symbol: 'write',
			state: 'rejects-write-when-edits-is-not-an-array',
			evidence: 'examples-cases',
			file: 'rejects-write-when-edits-is-not-an-array.json'
		},
		[
			{
				name: 'edits given as a string sends no config request',
				input,
				error: errorSummary(error)
			}
		]
	);
});

test('Forwards non-model edits to config batch write', async () => {
	const calls: Call[] = [];
	const service = new NativePickerDefaultsService(fakeRpc(calls));
	const options = { timeoutMs: 1000 };
	const input = { edits: [SANDBOX_EDIT] };
	const result = await service.write(input, options);

	expect(calls).toEqual([{ method: 'config/batchWrite', params: input, options }]);
	expect(result).toEqual({ status: 'written' });
	recordExampleCases(
		{
			unitId: 'service.native-picker-defaults',
			symbol: 'write',
			state: 'forwards-non-model-edits-to-config-batch-write',
			evidence: 'examples-cases',
			file: 'forwards-non-model-edits-to-config-batch-write.json'
		},
		[
			{
				name: 'sandbox edit is sent to config/batchWrite with its options',
				input: { params: input, options },
				output: result
			}
		]
	);
});

test('Overlays a saved model on config read', async () => {
	await withTempDir('native-picker-defaults-', async (directory) => {
		const catalogPath = join(directory, 'model-catalog.json');
		const calls: Call[] = [];
		const service = new NativePickerDefaultsService(
			fakeRpc(calls, { model: 'original-model' }),
			catalogPath
		);
		await service.write({ edits: [MODEL_EDIT] });
		const result = await service.read({});
		const config = result.config as Record<string, unknown>;

		expect(calls.map((call) => call.method)).toEqual(['config/batchWrite', 'config/read']);
		expect(config.model).toBe('gpt-5');
		expect(typeof config.model_provider).toBe('string');
		recordExampleCases(
			{
				unitId: 'service.native-picker-defaults',
				symbol: 'read',
				state: 'overlays-a-saved-model-on-config-read',
				evidence: 'examples-cases',
				file: 'overlays-a-saved-model-on-config-read.json'
			},
			[
				{
					name: 'saved model edit overrides the model returned by config/read',
					input: { edits: [MODEL_EDIT], readParams: {} },
					output: {
						methods: calls.map((call) => call.method),
						model: config.model,
						model_provider: config.model_provider
					}
				}
			]
		);
	});
});
