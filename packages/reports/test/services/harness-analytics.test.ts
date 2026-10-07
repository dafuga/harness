import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, test, vi } from 'vitest';
import { HarnessAnalyticsService } from '../../src/services/HarnessAnalyticsService';
afterEach(() => vi.unstubAllEnvs());
test('dashboard queries the real CLI aggregation and preserves validated filters', async () => {
	const root = await mkdtemp(join(tmpdir(), 'dashboard-analytics-'));
	vi.stubEnv('HARNESS_ANALYTICS_HOME', root);
	vi.stubEnv('HARNESS_ANALYTICS_DISABLED', '1');
	vi.stubEnv('HARNESS_CLI_PATH', join(process.cwd(), '../../src/index.ts'));
	try {
		const service = new HarnessAnalyticsService();
		const data = await service.snapshot(new URLSearchParams({ since: '2026-10-01' }));
		expect(data.summary.events).toBe(0);
		expect(data.filters.since).toBe('2026-10-01T00:00:00.000Z');
		expect(data.jev.response.firstTry.rate).toBeNull();
		await expect(service.snapshot(new URLSearchParams({ since: 'invalid' }))).rejects.toThrow(
			'query failed'
		);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});
