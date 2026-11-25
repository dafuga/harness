import { expect, test } from 'vitest';
import { QuotaClaudeAdapter } from '../../../src/adapters/agents-providers/QuotaClaudeAdapter';

const now = Date.parse('2026-11-25T23:20:00Z');

test('reads Claude plan usage without capturing unrelated screen text', async () => {
	const readUsage = async () =>
		[
			'Claude Max',
			'Current session',
			'████▌                              75% used',
			'Resets 12:15am (UTC)',
			'Current week (all models)',
			'███                45% used',
			'Resets Dec 1 at 11pm (UTC)',
			'Current week (Fable)',
			'0% used',
			'Extra usage',
			'100% used',
			'a private unrelated row'
		].join('\n');
	expect(await new QuotaClaudeAdapter({ readUsage }).read(now)).toEqual({
		id: 'claude',
		provider: 'claude',
		plan: 'Max',
		account: null,
		readAt: '2026-11-25T23:20:00.000Z',
		limits: [
			{ id: '5h', label: '5-hour', left: 25, resetsAt: '2026-11-26T00:15:00.000Z' },
			{ id: 'weekly', label: 'Weekly', left: 55, resetsAt: '2026-12-01T23:00:00.000Z' },
			{ id: 'fable', label: 'Fable', left: 100, resetsAt: null }
		],
		credits: null,
		history: [],
		agents: []
	});
});

test('an unavailable usage screen has no reading', async () => {
	const readUsage = async () => 'Failed to load usage data\nTotal cost: $0.00';
	expect(await new QuotaClaudeAdapter({ readUsage }).read(now)).toBeNull();
});
