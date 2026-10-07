import { defineConfig } from '@playwright/test';
process.env.PROJECT_REPORTS_HOME = '/tmp/project-reports-e2e';
process.env.HARNESS_ANALYTICS_HOME ??= '/tmp/harness-reports-analytics-e2e';
process.env.HARNESS_ANALYTICS_DISABLED = '1';
const port = Number(process.env.PROJECT_REPORTS_E2E_PORT || 5589);
const storagePort = Number(process.env.PROJECT_REPORTS_E2E_R2_PORT || 5590);
export default defineConfig({
	testDir: 'tests/e2e',
	workers: 1,
	use: { baseURL: `http://127.0.0.1:${port}`, screenshot: 'only-on-failure' },
	reporter: [['list'], ['json', { outputFile: 'test-results/results.json' }]],
	webServer: [
		{
			command: 'bun scripts/fake-r2.ts',
			url: `http://127.0.0.1:${storagePort}/health`,
			reuseExistingServer: true
		},
		{
			command: `PROJECT_REPORTS_ASSET_STORAGE=local bun scripts/seed-e2e.ts && PROJECT_REPORTS_HOME=/tmp/project-reports-e2e PROJECT_REPORTS_ASSET_STORAGE=r2 PROJECT_REPORTS_R2_ACCOUNT_ID=fake PROJECT_REPORTS_R2_BUCKET=project-reports-test PROJECT_REPORTS_R2_ACCESS_KEY_ID=test PROJECT_REPORTS_R2_SECRET_ACCESS_KEY=test PROJECT_REPORTS_R2_ENDPOINT=http://127.0.0.1:${storagePort} bun run dev --port ${port}`,
			url: `http://127.0.0.1:${port}`,
			reuseExistingServer: true
		}
	]
});
