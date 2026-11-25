import { expect, test, vi } from 'vitest';
import {
	claudeSubscription,
	createClaudeQuotaSource
} from '../../src/lib/development-tooling/desktop-initialization/tracker-overview-publisher/claudeQuotaSource';
import { createHomeProviderReader } from '../../src/lib/development-tooling/desktop-initialization/tracker-overview-publisher/homeProviderReader';

const now = Date.parse('2026-11-25T21:00:00Z');
const usage = {
	limits: [
		{ kind: 'session', percent: 3, resets_at: '2026-11-26T01:40:00+00:00', scope: null },
		{ kind: 'weekly_all', percent: 26, resets_at: '2026-11-29T21:00:00+00:00', scope: null },
		{
			kind: 'weekly_scoped',
			percent: 9,
			resets_at: '2026-11-29T21:00:00+00:00',
			scope: { model: { id: null, display_name: 'Fable' } }
		},
		{ kind: 'weekly_scoped', percent: 1, resets_at: null, scope: { model: null } }
	]
};

test('the limits list becomes 5-hour, weekly and per-model weekly readings', () => {
	const reading = claudeSubscription(usage, 'max', now);
	expect(reading).toMatchObject({ id: 'claude', provider: 'claude', plan: 'Max', account: null });
	expect(reading?.limits).toEqual([
		{ id: 'session', label: '5-hour window', left: 97, resetsAt: '2026-11-26T01:40:00.000Z' },
		{ id: 'weekly', label: 'Weekly', left: 74, resetsAt: '2026-11-29T21:00:00.000Z' },
		{ id: 'weekly-fable', label: 'Weekly Fable', left: 91, resetsAt: '2026-11-29T21:00:00.000Z' }
	]);
});

test('older replies without a limits list fall back to the per-window keys', () => {
	const reading = claudeSubscription(
		{
			five_hour: { utilization: 40, resets_at: null },
			seven_day: { utilization: 100, resets_at: null },
			seven_day_opus: null
		},
		null,
		now
	);
	expect(reading?.limits.map((limit) => [limit.id, limit.left])).toEqual([
		['session', 60],
		['weekly', 0]
	]);
	expect(reading?.plan).toBeNull();
});

test('a reply with no usable windows is unknown', () => {
	expect(claudeSubscription({ limits: [] }, 'pro', now)).toBeNull();
});

test('the token goes only to the fixed usage address and never into the reading', async () => {
	const fetcher = vi.fn(async () => new Response(JSON.stringify(usage)));
	const source = createClaudeQuotaSource({
		credential: async () => ({ token: 'fixture-token-value', plan: 'max' }),
		fetcher: fetcher as unknown as typeof fetch
	});
	const reading = await source(now);
	const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
	expect(url).toBe('https://api.anthropic.com/api/oauth/usage');
	expect((init.headers as Record<string, string>).Authorization).toBe('Bearer fixture-token-value');
	expect(init.redirect).toBe('error');
	expect(JSON.stringify(reading)).not.toContain('fixture-token-value');
});

test('no login, a refused token or a failed call is unknown', async () => {
	const login = async () => ({ token: 'fixture-token-value', plan: null });
	expect(await createClaudeQuotaSource({ credential: async () => null })(now)).toBeNull();
	const refused = vi.fn(async () => new Response('{}', { status: 401 }));
	expect(
		await createClaudeQuotaSource({
			credential: login,
			fetcher: refused as unknown as typeof fetch
		})(now)
	).toBeNull();
	const broken = createClaudeQuotaSource({
		credential: login,
		fetcher: (async () => {
			throw new Error('offline');
		}) as unknown as typeof fetch
	});
	const read = createHomeProviderReader(undefined, [broken]);
	expect(await read(now)).toEqual({ routines: null, quota: null });
});
