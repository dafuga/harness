import { defineConfig } from '@playwright/test';
process.env.PROJECT_REPORTS_HOME = '/tmp/project-reports-e2e';
process.env.HARNESS_ANALYTICS_HOME ??= '/tmp/harness-reports-analytics-e2e';
process.env.HARNESS_ANALYTICS_DISABLED = '1';
const port = Number(process.env.PROJECT_REPORTS_E2E_PORT || 5589);
const storagePort = Number(process.env.PROJECT_REPORTS_E2E_R2_PORT || 5590);
// Two more servers prove protection: one with no owner policy, one reachable from other hosts.
const lockedPort = Number(process.env.HARNESS_CONSOLE_E2E_LOCKED_PORT || 5591);
const exposedPort = Number(process.env.HARNESS_CONSOLE_E2E_EXPOSED_PORT || 5592);
// A fourth serves the same console over a registry of several hundred generated units.
const scalePort = Number(process.env.HARNESS_CONSOLE_E2E_SCALE_PORT || 5593);
const consoleHome = process.env.HARNESS_CONSOLE_E2E_HOME ?? '/tmp/harness-console-e2e';
// A built server is told the revision under verification, or a placeholder that claims none.
const revision = process.env.HARNESS_VERIFY_REVISION ?? '0'.repeat(40);
// harness verify has already compiled the snapshot; rebuilding would change the build it identified.
const compile = process.env.HARNESS_VERIFY ? 'true' : 'bun run build';
const reports = [
	'PROJECT_REPORTS_HOME=/tmp/project-reports-e2e',
	'PROJECT_REPORTS_ASSET_STORAGE=r2',
	'PROJECT_REPORTS_R2_ACCOUNT_ID=fake',
	'PROJECT_REPORTS_R2_BUCKET=project-reports-test',
	'PROJECT_REPORTS_R2_ACCESS_KEY_ID=test',
	'PROJECT_REPORTS_R2_SECRET_ACCESS_KEY=test',
	`PROJECT_REPORTS_R2_ENDPOINT=http://127.0.0.1:${storagePort}`,
	`HARNESS_CONSOLE_DATA=${consoleHome}/data`,
	// The application these servers are hosted for; another one shares the same stores.
	'HARNESS_SITE_ROOT=/tmp/alpha-project'
].join(' ');
const owner = 'HARNESS_OWNER_MODE=loopback HARNESS_BIND=127.0.0.1';
const seed = `bun scripts/seed-sites.ts && PROJECT_REPORTS_ASSET_STORAGE=local bun scripts/seed-e2e.ts && HARNESS_CONSOLE_E2E_HOME=${consoleHome} bun scripts/seed-harness-console.ts`;
const built = (extra: string, host: string, at: number) =>
	`${reports} ${extra} HARNESS_VERIFY_REVISION=${revision} HOST=${host} PORT=${at} bun build/index.js`;
const scale = `${owner} HARNESS_CONSOLE_DATA=${consoleHome}/scale`;
export default defineConfig({
	testDir: 'tests/e2e',
	// The provider picker has its own preview server; it runs under src/config/pickerPlaywrightConfig.ts.
	testIgnore: 'provider-picker.spec.ts',
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
			command: `${seed} && ${reports} ${owner} bun run dev --port ${port}`,
			url: `http://127.0.0.1:${port}/api/health`,
			timeout: 240_000,
			reuseExistingServer: true
		},
		{
			command: `${compile} && (${built('', '127.0.0.1', lockedPort)} & ${built(scale, '127.0.0.1', scalePort)} & ${built(owner, '0.0.0.0', exposedPort)})`,
			url: `http://127.0.0.1:${exposedPort}/api/health`,
			timeout: 240_000,
			reuseExistingServer: true
		}
	]
});
