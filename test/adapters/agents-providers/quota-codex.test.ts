import { expect, test } from 'vitest';
import { QuotaCodexAdapter } from '../../../src/adapters/agents-providers/QuotaCodexAdapter';

const now = Date.parse('2026-11-25T18:00:00Z');
const limit = (usedPercent: number, windowDurationMins: number) => ({
	usedPercent,
	windowDurationMins,
	resetsAt: now / 1000 + 3600
});

test('reads Codex subscription windows by duration and publishes only display data', async () => {
	const source = {
		accountId: 'private-account-canary',
		rateLimits: {
			primary: limit(74, 10080),
			secondary: limit(23, 300),
			planType: 'pro',
			credits: { balance: '124', hasCredits: true, unlimited: false }
		},
		rateLimitsByLimitId: { other_model: { primary: limit(100, 300) } }
	};
	const result = await new QuotaCodexAdapter({ readRpc: async () => source }).read(now);
	expect(result).toEqual({
		id: 'codex',
		provider: 'codex',
		plan: 'Pro',
		account: null,
		readAt: '2026-11-25T18:00:00.000Z',
		limits: [
			{ id: '5h', label: '5-hour', left: 77, resetsAt: '2026-11-25T19:00:00.000Z' },
			{ id: 'weekly', label: 'Weekly', left: 26, resetsAt: '2026-11-25T19:00:00.000Z' }
		],
		credits: '124',
		history: [],
		agents: []
	});
});

test('only known windows and balances are accepted, and missing windows remain unknown', async () => {
	const adapter = new QuotaCodexAdapter({
		readRpc: async () => ({
			rateLimits: {
				primary: limit(10, 10080),
				secondary: limit(101, 300),
				planType: 'unrecognized',
				credits: { balance: 'private-credit-canary', hasCredits: true }
			},
			rateLimitResetCredits: { availableCount: 2 }
		})
	});
	expect(await adapter.read(now)).toMatchObject({
		plan: null,
		limits: [{ id: 'weekly', left: 90 }],
		credits: null
	});
	expect(await new QuotaCodexAdapter({ readRpc: async () => null }).read(now)).toBeNull();
});
