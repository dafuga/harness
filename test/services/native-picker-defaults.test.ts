import { expect, test, vi } from 'vitest';
import { NativePickerDefaultsService } from '../../src/services/NativePickerDefaultsService';

test('picker selection becomes visible to the copy without writing original defaults', async () => {
	const rpc = vi.fn(async (method: string) =>
		method === 'config/read'
			? {
					config: { model: 'gpt-6.1-sol', model_provider: 'openai', model_reasoning_effort: 'max' }
				}
			: { status: 'ok' }
	);
	const defaults = new NativePickerDefaultsService(rpc);
	await defaults.write({
		edits: [
			{ keyPath: 'model', value: 'claude-opus-5-5' },
			{ keyPath: 'model_reasoning_effort', value: 'high' }
		]
	});
	expect(rpc).toHaveBeenLastCalledWith(
		'config/batchWrite',
		expect.objectContaining({ edits: [] }),
		undefined
	);
	expect((await defaults.read({})).config).toMatchObject({
		model: 'claude-opus-5-5',
		model_provider: 'harness-claude',
		model_reasoning_effort: 'xhigh'
	});
	expect((await new NativePickerDefaultsService(rpc).read({})).config).toMatchObject({
		model: 'gpt-6.1-sol'
	});
});

test('unrelated config edits still reach Codex and a failed write leaves the selection unchanged', async () => {
	const rpc = vi.fn(async () => ({ status: 'ok' }));
	const defaults = new NativePickerDefaultsService(rpc);
	await defaults.write({
		edits: [
			{ keyPath: 'model', value: 'claude-opus-5-5' },
			{ keyPath: 'personality', value: 'friendly' }
		]
	});
	expect(rpc).toHaveBeenLastCalledWith(
		'config/batchWrite',
		{ edits: [{ keyPath: 'personality', value: 'friendly' }] },
		undefined
	);
	rpc.mockRejectedValueOnce(new Error('write failed'));
	await expect(
		defaults.write({ edits: [{ keyPath: 'model', value: 'gpt-6.1-sol' }] })
	).rejects.toThrow('write failed');
	rpc.mockResolvedValueOnce({ config: { model: 'gpt-6.1-sol' } } as never);
	expect((await defaults.read({})).config).toMatchObject({ model: 'claude-opus-5-5' });
});
