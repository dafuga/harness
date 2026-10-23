import { defineConfig } from '@playwright/test';
import { resolve } from 'node:path';
import { namedE2eRun, openE2eRun } from './src/utils/e2e-fixtures/e2eFixtures';
// Every run seeds a directory of its own and listens on ports of its own, so two runs at once,
// from one checkout or from two verification snapshots, never read or remove each other's
// fixtures. The first process of a run chooses both; its servers, seeds and specs inherit them.
const fixtures = openE2eRun();
process.env.PROJECT_REPORTS_HOME = fixtures.reports;
process.env.HARNESS_ANALYTICS_HOME = fixtures.analytics;
process.env.HARNESS_ANALYTICS_DISABLED = '1';
const port = Number(process.env.PROJECT_REPORTS_E2E_PORT);
const storagePort = Number(process.env.PROJECT_REPORTS_E2E_R2_PORT);
// Two more servers prove protection: one with no owner policy, one reachable from other hosts.
const lockedPort = Number(process.env.HARNESS_CONSOLE_E2E_LOCKED_PORT);
const exposedPort = Number(process.env.HARNESS_CONSOLE_E2E_EXPOSED_PORT);
// A fourth serves the same console over a registry of several hundred generated units.
const scalePort = Number(process.env.HARNESS_CONSOLE_E2E_SCALE_PORT);
const consoleHome = fixtures.console;
// A built server is told the revision under verification, or a placeholder that claims none.
const revision = process.env.HARNESS_VERIFY_REVISION ?? '0'.repeat(40);
// harness verify has already compiled the snapshot; rebuilding would change the build it identified.
const compile = process.env.HARNESS_VERIFY ? 'true' : 'bun run build';
// A running server is adopted only when the caller named the directory it serves; a run that
// made its own, and every verification, starts the servers of its own fixtures and snapshot.
const reuseExistingServer = !process.env.HARNESS_VERIFY && namedE2eRun();
const reports = [
	`PROJECT_REPORTS_HOME=${fixtures.reports}`,
	'PROJECT_REPORTS_ASSET_STORAGE=r2',
	'PROJECT_REPORTS_R2_ACCOUNT_ID=fake',
	'PROJECT_REPORTS_R2_BUCKET=project-reports-test',
	'PROJECT_REPORTS_R2_ACCESS_KEY_ID=test',
	'PROJECT_REPORTS_R2_SECRET_ACCESS_KEY=test',
	`PROJECT_REPORTS_R2_ENDPOINT=http://127.0.0.1:${storagePort}`,
	`HARNESS_CONSOLE_DATA=${consoleHome}/data`,
	// The application these servers are hosted for; another one shares the same stores.
	`HARNESS_SITE_ROOT=${fixtures.site('alpha-project')}`
].join(' ');
const owner = 'HARNESS_OWNER_MODE=loopback HARNESS_BIND=127.0.0.1';
const seed =
	'bun scripts/seed-sites.ts && PROJECT_REPORTS_ASSET_STORAGE=local bun scripts/seed-e2e.ts && bun scripts/seed-harness-console.ts';
// A built server is started as `harness report` starts it: told where the command line is.
const cli = `HARNESS_CLI_PATH=${resolve('../../src/index.ts')}`;
// Every server of a run is started from the run's own copy of the finished build: a built
// server loads its files as they are asked for, and another build in this checkout would replace
// them under it. A run starts no development server. One keeps what it generates in the checkout,
// writes it again whenever it starts, and tells its pages to load again when another does.
const freeze = 'bun scripts/freeze-build.ts';
const built = (extra: string, host: string, at: number) =>
	`${reports} ${extra} ${cli} HARNESS_VERIFY_REVISION=${revision} HOST=${host} PORT=${at} bun ${fixtures.build}/index.js`;
// The application under test is served as `harness report serve` serves it: told where the
// package is, its own address for form posts, and the upload limit.
const application = [
	owner,
	`ORIGIN=http://127.0.0.1:${port}`,
	'BODY_SIZE_LIMIT=110M',
	`HARNESS_REPORTS_RUNTIME_ROOT=${resolve('.')}`
].join(' ');
const scale = `${owner} HARNESS_CONSOLE_DATA=${consoleHome}/scale`;
export default defineConfig({
	testDir: 'tests/e2e',
	// The provider picker has its own preview server; it runs under src/configs/pickerPlaywrightConfig.ts.
	// The explorer shell needs no server at all; it runs under src/configs/shellPlaywrightConfig.ts.
	// Its specs are named by their file, so a checkout in a directory of a like name loses none.
	testIgnore: ['provider-picker.spec.ts', /[\\/]explorer-shell[^\\/]*\.spec\.ts$/],
	workers: 1,
	globalTeardown: './tests/e2e/support/removeFixtures.ts',
	use: { baseURL: `http://127.0.0.1:${port}`, screenshot: 'only-on-failure' },
	reporter: [['list'], ['json', { outputFile: 'test-results/results.json' }]],
	webServer: [
		{
			command: 'bun scripts/fake-r2.ts',
			url: `http://127.0.0.1:${storagePort}/health`,
			reuseExistingServer
		},
		{
			// Seeding and, outside a verification, building both come before the first server
			// now, so this entry has the time the two had between them and the next has little.
			command: `${seed} && ${compile} && ${freeze} && ${built(application, '127.0.0.1', port)}`,
			url: `http://127.0.0.1:${port}/api/health`,
			// Evidence runs rebuild the complete Git fixture before their first capture.
			timeout: process.env.HARNESS_EVIDENCE_DIR ? 900_000 : 420_000,
			reuseExistingServer
		},
		{
			command: `${built('', '127.0.0.1', lockedPort)} & ${built(scale, '127.0.0.1', scalePort)} & ${built(owner, '0.0.0.0', exposedPort)}`,
			url: `http://127.0.0.1:${exposedPort}/api/health`,
			timeout: 60_000,
			reuseExistingServer
		}
	]
});
