import { expect, test, vi } from 'vitest';
import { QuotaClaudeAdapter } from '../../../src/adapters/agents-providers/QuotaClaudeAdapter';
import { openUsage } from '../../../src/adapters/agents-providers/quota-claude-adapter/readClaudeUsage';

const now = Date.parse('2026-11-25T23:20:00Z');

test('opens the built-in usage command from an interactive composer with a suggestion', async () => {
	let typed = false;
	const run = vi.fn(async (command: string, ...args: string[]) => {
		if (command === 'capture-pane')
			return typed
				? 'Claude Code\n❯ /usage\n/usage Show plan usage and activity stats'
				: 'Claude Code\n❯ Try "explain a file"';
		if (args[0] === '-l') typed = true;
		return '';
	});
	expect(await openUsage(run, '/private/tmp/quota')).toBe(true);
	expect(run).toHaveBeenCalledWith('send-keys', '-l', '/usage');
	expect(run).toHaveBeenLastCalledWith('send-keys', 'Enter');
}, 10000);

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
