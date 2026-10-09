import { expect, test, vi } from 'vitest';
import { NativePickerBridgeService } from '../../src/services/NativePickerBridgeService';

test('native picker adds Opus without replacing native discovery or writing global defaults', async () => {
	const rpc = vi.fn(async () => ({ data: [{ model: 'gpt-6.1-sol' }], nextCursor: null }));
	const bridge = new NativePickerBridgeService(rpc);
	const result = await bridge.send('model/list', {});
	expect(result.data).toEqual(
		expect.arrayContaining([
			expect.objectContaining({ model: 'gpt-6.1-sol' }),
			expect.objectContaining({ model: 'claude-opus-5-5' })
		])
	);
	expect(rpc.mock.calls).toHaveLength(1);
});

test('new Claude selection sets provider and effort while OpenAI defaults remain native', async () => {
	const rpc = vi.fn(async (_method: string, params: Record<string, unknown>) => ({
		...params,
		thread: { id: 't' }
	}));
	const bridge = new NativePickerBridgeService(rpc);
	await bridge.send('thread/start', { model: 'claude-opus-5-5' });
	expect(rpc).toHaveBeenLastCalledWith(
		'thread/start',
		expect.objectContaining({
			modelProvider: 'harness-claude',
			config: expect.objectContaining({ model_reasoning_effort: 'xhigh', web_search: 'disabled' })
		}),
		undefined
	);
	await bridge.send('thread/start', { model: 'gpt-6.1-sol' });
	expect(rpc).toHaveBeenLastCalledWith(
		'thread/start',
		expect.objectContaining({ modelProvider: 'openai' }),
		undefined
	);
});

test('cold hydration retains the persisted provider when no new model is selected', async () => {
	const rpc = vi.fn(async (method: string) =>
		method === 'thread/read'
			? { thread: { modelProvider: 'harness-claude', model: 'claude-opus-5-5' } }
			: { thread: { id: 't' }, modelProvider: 'harness-claude', model: 'claude-opus-5-5' }
	);
	await new NativePickerBridgeService(rpc).send('thread/resume', {
		threadId: 't',
		model: null,
		modelProvider: 'openai'
	});
	expect(rpc).toHaveBeenLastCalledWith(
		'thread/resume',
		expect.objectContaining({ modelProvider: 'harness-claude', model: 'claude-opus-5-5' }),
		undefined
	);
});

test('explicit hydration cannot change a loaded provider without closing the chat', async () => {
	const rpc = vi.fn(async () => ({
		thread: { model: 'gpt-6.1-sol', modelProvider: 'openai', status: { type: 'idle' } }
	}));
	await expect(
		new NativePickerBridgeService(rpc).send('thread/resume', {
			threadId: 't',
			model: 'claude-opus-5-5'
		})
	).rejects.toThrow('Close');
	expect(rpc.mock.calls).toHaveLength(1);
});

test('recent chats include both providers while explicit filters remain unchanged', async () => {
	const rpc = vi.fn(async () => ({ data: [] }));
	const bridge = new NativePickerBridgeService(rpc);
	await bridge.send('thread/list', { modelProviders: null });
	expect(rpc).toHaveBeenLastCalledWith(
		'thread/list',
		{ modelProviders: ['openai', 'harness-claude'] },
		undefined
	);
	await bridge.send('thread/list', { modelProviders: ['openai'] });
	expect(rpc).toHaveBeenLastCalledWith('thread/list', { modelProviders: ['openai'] }, undefined);
});
