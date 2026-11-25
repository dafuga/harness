import { expect, test, vi } from 'vitest';
import { SubscriptionQuotaService } from '../../../src/services/agents-providers/SubscriptionQuotaService';

const now = Date.parse('2026-11-25T18:00:00Z');

test('shares one refresh, preserves a fresh successful provider during failures and expires it', async () => {
	const claude = vi.fn(async (at: number) => ({
		id: 'claude',
		provider: 'claude' as const,
		plan: null,
		account: null,
		readAt: new Date(at).toISOString(),
		limits: [{ id: 'weekly', label: 'Weekly', left: 4, resetsAt: null }],
		credits: null,
		history: [],
		agents: []
	}));
	const codex = vi.fn(async () => {
		throw new Error('raw failure is private');
	});
	const service = new SubscriptionQuotaService([claude, codex]);
	const [first, second] = await Promise.all([service.read(now), service.read(now)]);
	expect(first).toEqual(second);
	expect(first).toHaveLength(1);
	expect(claude).toHaveBeenCalledTimes(1);
	expect(codex).toHaveBeenCalledTimes(1);
	claude.mockRejectedValue(new Error('raw failure is private'));
	expect(await service.read(now + 300_001)).toEqual(first);
	expect(await service.read(now + 3_600_001)).toEqual([]);
});
