import { expect, test, vi } from 'vitest';
import { DecartAdapter } from '../../src/adapters/agents-providers/DecartAdapter';

test('tokens have model and duration limits and concurrent starts are refused', async () => {
	const create = vi.fn(async () => ({ apiKey: 'test-ephemeral', expiresAt: '2099-01-01' }));
	const adapter = new DecartAdapter({ create }, () => 1);
	const input = { projectId: 'test', model: 'lucy-restyle-2' as const, fast: false, seconds: 60 };
	const result = await adapter.start(input);
	expect(result.rate).toBe(0.01);
	expect(create).toHaveBeenCalledWith(
		expect.objectContaining({
			allowedModels: ['lucy-restyle-2'],
			constraints: { realtime: { maxSessionDuration: 60 } }
		})
	);
	await expect(adapter.start(input)).rejects.toThrow('lease');
});
test('invalid duration and unsupported fast mode never mint a token', async () => {
	const create = vi.fn();
	const adapter = new DecartAdapter({ create });
	for (const input of [
		{ seconds: 61, fast: false },
		{ seconds: 60, fast: true }
	])
		await expect(
			adapter.start({ projectId: 'test', model: 'lucy-restyle-2', ...input })
		).rejects.toThrow('Invalid');
	expect(create).not.toHaveBeenCalled();
});
