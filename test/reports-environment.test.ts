import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, test, vi } from 'vitest';
import { reportsEnvironment } from '../src/utils/reportsEnvironment';
afterEach(() => vi.unstubAllEnvs());
test('report settings preserve configuration references and explicit env takes precedence', async () => {
	const root = await mkdtemp(join(tmpdir(), 'harness-report-settings-'));
	const file = join(root, 'settings.json');
	vi.stubEnv('HARNESS_REPORTS_SETTINGS_FILE', file);
	try {
		await writeFile(
			file,
			JSON.stringify({
				configFile: '/fixture/reports.env',
				cloudflareConfigHome: '/fixture/isolated-auth'
			})
		);
		expect(reportsEnvironment().PROJECT_REPORTS_CONFIG_FILE).toBe('/fixture/reports.env');
		vi.stubEnv('PROJECT_REPORTS_CONFIG_FILE', '/explicit/reports.env');
		expect(reportsEnvironment().PROJECT_REPORTS_CONFIG_FILE).toBe('/explicit/reports.env');
		expect(reportsEnvironment().PROJECT_REPORTS_CLOUDFLARE_CONFIG_HOME).toBe(
			'/fixture/isolated-auth'
		);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});
