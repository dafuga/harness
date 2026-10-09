import { expect, test, vi } from 'vitest';
import { NativePickerSwitchService } from '../../src/services/NativePickerSwitchService';
import { nativePickerProtocol } from '../../src/utils/nativePickerProtocol';

function fixture(
	overrides: Record<string, Record<string, unknown>> = {},
	initial = { modelProvider: 'openai', model: 'gpt-6.1-sol', reasoningEffort: 'max' }
) {
	let selection = initial;
	let loaded = true;
	const rpc = vi.fn(async (method: string, params: Record<string, unknown>) => {
		if (method in overrides) return overrides[method];
		if (method === 'thread/read')
			return { thread: { id: 't', status: { type: 'idle' }, ...selection } };
		if (method === 'remoteControl/status/read') return { status: 'disabled' };
		if (method === 'thread/unsubscribe') {
			loaded = false;
			return { status: 'unsubscribed' };
		}
		if (method === 'thread/loaded/list') return { data: loaded ? ['t'] : [], nextCursor: null };
		if (method === 'thread/resume') {
			selection = {
				modelProvider: String(params.modelProvider),
				model: String(params.model),
				reasoningEffort: String((params.config as Record<string, unknown>).model_reasoning_effort)
			};
			return { ...selection, thread: { id: 't', ...selection } };
		}
		return {};
	});
	return rpc;
}

test('switch closes all subscriptions before verified same-thread resume', async () => {
	const rpc = fixture();
	await new NativePickerSwitchService(rpc).apply({
		threadId: 't',
		model: 'claude-opus-5-5',
		effort: 'xhigh'
	});
	const methods = rpc.mock.calls.map(([method]) => method);
	expect(methods.indexOf('thread/unsubscribe')).toBeLessThan(methods.indexOf('thread/resume'));
	expect(methods.indexOf('thread/loaded/list')).toBeLessThan(methods.indexOf('thread/resume'));
	expect(methods.at(-1)).toBe('thread/read');
	expect(rpc).toHaveBeenCalledWith(
		'thread/resume',
		expect.objectContaining({ config: expect.objectContaining({ web_search: 'disabled' }) })
	);
});

test.each(['active', 'notLoaded', 'unknown'])(
	'provider switch rejects %s threads without altering them',
	async (type) => {
		const rpc = fixture({
			'thread/read': { thread: { status: { type }, modelProvider: 'openai' } }
		});
		await expect(
			new NativePickerSwitchService(rpc).apply({ threadId: 't', model: 'claude-opus-5-5' })
		).rejects.toThrow('idle');
		expect(rpc.mock.calls.some(([method]) => method === 'thread/unsubscribe')).toBe(false);
	}
);

test('remote client uncertainty blocks a switch instead of pretending every client closed', async () => {
	const rpc = fixture({ 'remoteControl/status/read': { status: 'connected' } });
	await expect(
		new NativePickerSwitchService(rpc).apply({ threadId: 't', model: 'claude-opus-5-5' })
	).rejects.toThrow('remote');
	expect(rpc.mock.calls.some(([method]) => method === 'thread/resume')).toBe(false);
});

test('remaining subscriptions leave the provider unchanged', async () => {
	const rpc = fixture({ 'thread/loaded/list': { data: ['t'], nextCursor: null } });
	await expect(
		new NativePickerSwitchService(rpc, { timeoutMs: 0 }).apply({
			threadId: 't',
			model: 'claude-opus-5-5'
		})
	).rejects.toThrow('closed');
	expect(rpc.mock.calls.some(([method]) => method === 'thread/resume')).toBe(false);
});

test('failed target resume restores the previous provider and verifies recovery', async () => {
	const base = fixture();
	const rpc = vi.fn(async (method: string, params: Record<string, unknown>) => {
		if (method === 'thread/resume' && params.modelProvider === 'harness-claude')
			throw new Error('gateway unavailable');
		return base(method, params);
	});
	await expect(
		new NativePickerSwitchService(rpc).apply({ threadId: 't', model: 'claude-opus-5-5' })
	).rejects.toThrow('previous settings restored');
	expect(rpc).toHaveBeenCalledWith(
		'thread/resume',
		expect.objectContaining({ modelProvider: 'openai', model: 'gpt-6.1-sol' })
	);
	expect(rpc.mock.calls.at(-1)?.[0]).toBe('thread/read');
});

test('unverifiable rollback reports manual recovery instead of success', async () => {
	const base = fixture();
	const rpc = vi.fn(async (method: string, params: Record<string, unknown>) => {
		if (method === 'thread/resume') throw new Error('process unavailable');
		return base(method, params);
	});
	await expect(
		new NativePickerSwitchService(rpc).apply({ threadId: 't', model: 'claude-opus-5-5' })
	).rejects.toThrow('manual recovery required');
});

test('loaded-list pagination cannot authorize an incomplete client check', async () => {
	const rpc = fixture({ 'thread/loaded/list': { data: [], nextCursor: 'more' } });
	await expect(
		new NativePickerSwitchService(rpc).apply({ threadId: 't', model: 'claude-opus-5-5' })
	).rejects.toThrow('every loaded chat');
	expect(rpc.mock.calls.some(([method]) => method === 'thread/resume')).toBe(false);
});

test('a completed failed turn can be closed for provider recovery', async () => {
	const base = fixture();
	const rpc = vi.fn(async (method: string, params: Record<string, unknown>) => {
		const result = await base(method, params);
		if (method === 'thread/read' && base.mock.calls.length < 6)
			return {
				thread: {
					...nativePickerProtocol(result.thread),
					status: { type: 'systemError' },
					turns: [{ status: 'failed' }]
				}
			};
		return result;
	});
	await new NativePickerSwitchService(rpc).apply({ threadId: 't', model: 'claude-opus-5-5' });
	expect(rpc).toHaveBeenCalledWith('thread/read', { threadId: 't', includeTurns: true });
});

test('a system error with an unfinished turn cannot authorize recovery', async () => {
	const rpc = fixture({
		'thread/read': {
			thread: { status: { type: 'systemError' }, turns: [{ status: 'inProgress' }] }
		}
	});
	await expect(
		new NativePickerSwitchService(rpc).apply({ threadId: 't', model: 'claude-opus-5-5' })
	).rejects.toThrow('idle');
	expect(rpc.mock.calls.some(([method]) => method === 'thread/unsubscribe')).toBe(false);
});

test('returning to OpenAI restores its web setting without the Claude catalog override', async () => {
	const rpc = fixture(
		{},
		{ modelProvider: 'harness-claude', model: 'claude-opus-5-5', reasoningEffort: 'xhigh' }
	);
	await new NativePickerSwitchService(rpc).apply(
		{ threadId: 't', model: 'gpt-6.1-sol', effort: 'max' },
		{ config: { web_search: 'live' } }
	);
	const resumed = rpc.mock.calls.find(([method]) => method === 'thread/resume')?.[1];
	expect(resumed).toMatchObject({
		modelProvider: 'openai',
		config: { web_search: 'live', model_reasoning_effort: 'max' }
	});
	expect((resumed?.config as Record<string, unknown>).model_catalog_json).toBeUndefined();
});
