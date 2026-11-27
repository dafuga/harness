import { execFileSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, expect, test, vi } from 'vitest';
import { runHarness } from './support/cli';
import { withTempDir } from './support/temporary';

afterEach(() => vi.unstubAllEnvs());

test('analytics events keeps validated filters and rejects an invalid since', () =>
	withTempDir('harness-analytics-events-', async (root) => {
		vi.stubEnv('HARNESS_ANALYTICS_HOME', root);
		vi.stubEnv('HARNESS_ANALYTICS_DISABLED', '1');
		const run = await runHarness(['analytics', 'events', '--json', '--since', '2026-10-01'], root);
		const data = JSON.parse(run.stdout);
		expect(data.summary.events).toBe(0);
		expect(data.filters.since).toBe('2026-10-01T00:00:00.000Z');
		expect(data.jev.response.firstTry.rate).toBeNull();
		await expect(
			runHarness(['analytics', 'events', '--json', '--since', 'invalid'], root)
		).rejects.toThrow();
	}));

test(
	'analytics events writes a complete large response before the reader parses it',
	() =>
		withTempDir('harness-analytics-large-', async (root) => {
			vi.stubEnv('HARNESS_ANALYTICS_HOME', root);
			vi.stubEnv('HARNESS_ANALYTICS_DISABLED', '1');
			const repository = fileURLToPath(
				new URL('../src/repositories/reports-media/AnalyticsRepository.ts', import.meta.url)
			);
			const fixture = join(root, 'fixture.ts');
			await writeFile(
				fixture,
				`import {AnalyticsRepository} from ${JSON.stringify(repository)}; const r=new AnalyticsRepository(); for(let i=0;i<4000;i++) r.record({id:String(i),timestamp:"2026-10-01T00:00:00.000Z",project:${JSON.stringify(root)},kind:"command",action:"x".repeat(512)}); r.close();`
			);
			execFileSync(process.env.HARNESS_BUN_PATH ?? 'bun', [fixture], { env: process.env });
			const run = await runHarness(['analytics', 'events', '--json'], root);
			expect(JSON.parse(run.stdout).summary.events).toBe(4000);
		}),
	60000
);
