import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
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

test('dashboard consumes a complete large analytics response before parsing', async () => {
	const root = await mkdtemp(join(tmpdir(), 'dashboard-large-'));
	const cli = join(root, 'fixture.ts');
	vi.stubEnv('HARNESS_CLI_PATH', join(process.cwd(), '../../src/index.ts'));
	vi.stubEnv('HARNESS_ANALYTICS_HOME', root);
	vi.stubEnv('HARNESS_ANALYTICS_DISABLED', '1');
	try {
		const repository = join(process.cwd(), '../../src/repositories/AnalyticsRepository.ts');
		await writeFile(
			cli,
			`import {AnalyticsRepository} from ${JSON.stringify(repository)}; const r=new AnalyticsRepository(); for(let i=0;i<4000;i++) r.record({id:String(i),timestamp:"2026-10-01T00:00:00.000Z",project:"/fixture",kind:"command",action:"x".repeat(512)}); r.close();`
		);
		execFileSync(process.env.HARNESS_BUN_PATH ?? 'bun', [cli], { env: process.env });
		const data = await new HarnessAnalyticsService().snapshot(new URLSearchParams());
		expect(data.summary.events).toBe(4000);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});
