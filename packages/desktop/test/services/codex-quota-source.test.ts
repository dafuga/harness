import { expect, test, vi } from 'vitest';
import {
	codexSubscription,
	createCodexQuotaSource
} from '../../src/lib/development-tooling/desktop-initialization/tracker-overview-publisher/codexQuotaSource';
import { createHomeProviderReader } from '../../src/lib/development-tooling/desktop-initialization/tracker-overview-publisher/homeProviderReader';

const now = Date.parse('2026-11-25T20:00:00Z');
const resetsAt = Math.floor(Date.parse('2026-11-26T01:00:00Z') / 1000);

test('Codex windows become left-percent limits labelled by their length, with credits', () => {
	const reading = codexSubscription(
		{
			planType: 'pro',
			primary: { usedPercent: 27, windowDurationMins: 300, resetsAt },
			secondary: { usedPercent: 100, windowDurationMins: 10080, resetsAt: null },
			credits: { hasCredits: true, unlimited: false, balance: '12.5' }
		},
		now
	);
	expect(reading).toMatchObject({
		id: 'codex',
		provider: 'codex',
		plan: 'Pro',
		account: null,
		credits: '12.5',
		limits: [
			{ id: 'primary', label: '5-hour window', left: 73, resetsAt: '2026-11-26T01:00:00.000Z' },
			{ id: 'secondary', label: 'Weekly', left: 0, resetsAt: null }
		]
	});
});

test('a Codex reply without windows is unknown, not an empty subscription', () => {
	expect(codexSubscription({ planType: 'pro', primary: null, secondary: null }, now)).toBeNull();
});

test('the source asks Codex for its rate limits and always closes the connection', async () => {
	const request = vi.fn(async () => ({
		rateLimits: { primary: { usedPercent: 10, windowDurationMins: 300 } }
	}));
	const dispose = vi.fn();
	const source = createCodexQuotaSource((async () => ({ request, dispose })) as never);
	expect((await source(now))?.limits[0].left).toBe(90);
	expect(request).toHaveBeenCalledWith('account/rateLimits/read', {}, 15000);
	expect(dispose).toHaveBeenCalledOnce();
});

test('the reader keeps a source’s last good reading when a later read fails', async () => {
	const good = codexSubscription({ primary: { usedPercent: 40, windowDurationMins: 300 } }, now)!;
	const source = vi
		.fn<() => Promise<typeof good | null>>()
		.mockResolvedValueOnce(good)
		.mockRejectedValueOnce(new Error('offline'));
	const read = createHomeProviderReader(undefined, [source]);
	expect((await read(now)).quota).toEqual([good]);
	expect((await read(now + 300_000)).quota).toEqual([good]);
});

test('the reader stays unknown when no source answers', async () => {
	const read = createHomeProviderReader(undefined, [async () => null]);
	expect(await read(now)).toEqual({ routines: null, quota: null });
});
