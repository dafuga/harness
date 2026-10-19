import { mkdtemp, rm, writeFile, mkdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, expect, test, vi } from 'vitest';
import { runCommand } from './support/cli';
import { reportsEnvironment } from '../src/workflows/run-report/reportsEnvironment';
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

test('a relocated report launcher finds installed runtime files beside its bundle', async () => {
	const root = await mkdtemp(join(tmpdir(), 'harness-report-runtime-'));
	try {
		const manifest = JSON.parse(
			await readFile(
				new URL('../specification/units/workflow.run-report.json', import.meta.url),
				'utf8'
			)
		);
		const bundle = join(root, 'dist/index.js');
		await mkdir(join(root, 'dist/reports'), { recursive: true });
		await runCommand(
			['bun', 'build', resolve(manifest.runtime.entry), '--target', 'bun', '--outfile', bundle],
			root
		);
		await writeFile(
			join(root, 'dist/reports/cli.js'),
			`console.log(JSON.stringify({ root: process.env.HARNESS_REPORTS_RUNTIME_ROOT, cli: process.env.HARNESS_CLI_PATH }));`
		);
		await writeFile(
			join(root, 'launch.ts'),
			`import { runReport } from './dist/index.js'; await runReport([]);`
		);
		const result = await runCommand(['bun', join(root, 'launch.ts')], root, false, {
			HARNESS_REPORTS_SETTINGS_FILE: join(root, 'not-configured.json')
		});
		expect(result.exitCode, 'installed report runtime resolves beside the bundled entry').toBe(0);
		expect(JSON.parse(result.stdout)).toEqual({ root: join(root, 'dist/reports'), cli: bundle });
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});
