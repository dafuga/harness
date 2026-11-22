import { join } from 'node:path';
import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { NativePickerBridgeService } from '../../src/services/development-tooling/native-picker-bridge-service/NativePickerBridgeService';
import { NativePickerError } from '../../src/services/development-tooling/native-picker-bridge-service/NativePickerBridgeService.types';

type Call = { method: string; params: Record<string, unknown> };

function fakeRpc(replies: Record<string, unknown>) {
	const calls: Call[] = [];
	const rpc = async (method: string, params: Record<string, unknown>) => {
		calls.push({ method, params });
		return (replies[method] ?? {}) as Record<string, unknown>;
	};
	return { rpc, calls };
}

async function capture(run: () => Promise<unknown>): Promise<unknown> {
	try {
		await run();
	} catch (caught) {
		return caught;
	}
	return undefined;
}

function errorRecord(error: unknown) {
	return { name: (error as Error).name, message: (error as Error).message };
}

test('Adds the Opus model when the model list lacks it', async () => {
	await withTempDir('native-picker-bridge-models-', async () => {
		const { rpc } = fakeRpc({ 'model/list': { data: [{ model: 'gpt-example' }] } });
		const result = await new NativePickerBridgeService(rpc).send('model/list', {});
		const data = result.data as Array<{ model?: unknown }>;

		expect(data).toHaveLength(2);
		expect(data[0]).toEqual({ model: 'gpt-example' });
		recordExampleCases(
			{
				unitId: 'service.native-picker-bridge',
				symbol: 'NativePickerBridgeService.send',
				state: 'adds-the-opus-model-when-the-model-list-lacks-it',
				evidence: 'examples-cases',
				file: 'adds-the-opus-model-when-the-model-list-lacks-it.json'
			},
			[
				{
					name: 'model list without the Opus model gets it appended',
					input: { method: 'model/list', data: [{ model: 'gpt-example' }] },
					output: { count: data.length, models: data.map((item) => item.model ?? null) }
				}
			]
		);
	});
});

test('Rejects a model list that is not an array', async () => {
	await withTempDir('native-picker-bridge-invalid-', async () => {
		const { rpc } = fakeRpc({ 'model/list': { data: 'none' } });
		const error = await capture(() => new NativePickerBridgeService(rpc).send('model/list', {}));

		expect(error).toBeInstanceOf(NativePickerError);
		expect((error as Error).message).toBe('Invalid model discovery response');
		recordExampleCases(
			{
				unitId: 'service.native-picker-bridge',
				symbol: 'NativePickerBridgeService.send',
				state: 'rejects-a-model-list-that-is-not-an-array',
				evidence: 'examples-cases',
				file: 'rejects-a-model-list-that-is-not-an-array.json'
			},
			[
				{
					name: 'non-array model discovery data is rejected',
					input: { method: 'model/list', data: 'none' },
					error: errorRecord(error)
				}
			]
		);
	});
});

test('Opens a harness-claude thread with the picker config', async () => {
	await withTempDir('native-picker-bridge-open-', async (directory) => {
		const catalogPath = join(directory, 'model-catalog.json');
		const { rpc, calls } = fakeRpc({ 'thread/start': { thread: { id: 'thread-1' } } });
		const bridge = new NativePickerBridgeService(rpc, catalogPath);
		const result = await bridge.send('thread/start', {
			modelProvider: 'harness-claude',
			config: { approval_policy: 'never' }
		});
		const sent = calls[0].params;
		const config = sent.config as Record<string, unknown>;

		expect(calls.map((call) => call.method)).toEqual(['thread/start']);
		expect(result).toEqual({ thread: { id: 'thread-1' } });
		expect(config).toEqual({
			approval_policy: 'never',
			model_reasoning_effort: 'xhigh',
			model_catalog_json: catalogPath,
			web_search: 'disabled'
		});
		recordExampleCases(
			{
				unitId: 'service.native-picker-bridge',
				symbol: 'NativePickerBridgeService.send',
				state: 'opens-a-harness-claude-thread-with-the-picker-config',
				evidence: 'examples-cases',
				file: 'opens-a-harness-claude-thread-with-the-picker-config.json'
			},
			[
				{
					name: 'thread start for harness-claude adds reasoning, catalog and web search settings',
					input: {
						method: 'thread/start',
						params: { modelProvider: 'harness-claude', config: { approval_policy: 'never' } },
						catalogPath: 'model-catalog.json'
					},
					output: {
						thread: result.thread,
						modelProvider: sent.modelProvider,
						config: { ...config, model_catalog_json: 'model-catalog.json' }
					}
				}
			]
		);
	});
});

test('Rejects resuming a loaded chat with another provider', async () => {
	await withTempDir('native-picker-bridge-resume-', async () => {
		const { rpc, calls } = fakeRpc({
			'thread/read': { thread: { modelProvider: 'openai', status: { type: 'idle' } } }
		});
		const params = { threadId: 'thread-1', modelProvider: 'harness-claude' };
		const error = await capture(() => new NativePickerBridgeService(rpc).send('thread/resume', params));

		expect(error).toBeInstanceOf(NativePickerError);
		expect((error as Error).message).toBe('Close this chat before resuming with a different provider');
		expect(calls.map((call) => call.method)).toEqual(['thread/read']);
		recordExampleCases(
			{
				unitId: 'service.native-picker-bridge',
				symbol: 'NativePickerBridgeService.send',
				state: 'rejects-resuming-a-loaded-chat-with-another-provider',
				evidence: 'examples-cases',
				file: 'rejects-resuming-a-loaded-chat-with-another-provider.json'
			},
			[
				{
					name: 'resuming an idle openai thread as harness-claude is rejected',
					input: { method: 'thread/resume', params, loadedProvider: 'openai' },
					error: errorRecord(error)
				}
			]
		);
	});
});

test('Rejects a provider switch without saved thread context', async () => {
	await withTempDir('native-picker-bridge-switch-', async () => {
		const { rpc, calls } = fakeRpc({
			'thread/read': { thread: { modelProvider: 'legacy-provider' } }
		});
		const params = { threadId: 'thread-1', model: 'gpt-example' };
		const error = await capture(() => new NativePickerBridgeService(rpc).send('turn/start', params));

		expect(error).toBeInstanceOf(NativePickerError);
		expect((error as Error).message).toBe(
			'Reopen this chat in the experimental client before switching'
		);
		expect(calls.map((call) => call.method)).toEqual(['thread/read']);
		recordExampleCases(
			{
				unitId: 'service.native-picker-bridge',
				symbol: 'NativePickerBridgeService.send',
				state: 'rejects-a-provider-switch-without-saved-thread-context',
				evidence: 'examples-cases',
				file: 'rejects-a-provider-switch-without-saved-thread-context.json'
			},
			[
				{
					name: 'turn with a model from another provider and no saved context is rejected',
					input: { method: 'turn/start', params, loadedProvider: 'legacy-provider' },
					error: errorRecord(error)
				}
			]
		);
	});
});
