import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { ownEnvironment } from './support/cli';
import { expect, test, vi } from 'vitest';
import { loadConfigFromFile } from 'vite';
import { measureWorkload } from './support/measureWorkload';
import { unitsConfigFile, unitsConfigSchema } from '../src/core/unitsConfig';
import { verifyConfigFile, verifyConfigSchema } from '../src/core/verifyTypes';
import { verifyPlan } from '../src/workflows/verification-evidence/run-verify/verification-service/verifyPlan';

/**
 * The checks verification plans for this repository's own declared configuration: an entity
 * preview spec lives outside tests/e2e, so only the entity preview Playwright config finds it.
 */
const config = verifyConfigSchema.parse(JSON.parse(readFileSync(verifyConfigFile, 'utf8')));
const unitsConfig = unitsConfigSchema.parse(JSON.parse(readFileSync(unitsConfigFile, 'utf8')));
const planned = (path: string) =>
	verifyPlan({ selectedTests: [path], scenarios: [], config, unitsConfig }).map((check) => ({
		cwd: check.cwd,
		target: check.target,
		runner: check.runner,
		command: check.command,
		timeoutMs: check.timeoutMs
	}));
const preview = (spec: string) =>
	`ENTITY_PREVIEW_HOME=output/entity-preview bun x playwright test --config test/entityPreviewPlaywright.ts test/${spec}`;
const plannedPreview = (spec: string) =>
	spec === 'entity-preview-contract.spec.ts' ? `bun x playwright test test/${spec}` : preview(spec);
const previews = readdirSync('packages/reports/test')
	.filter((name) => /^entity-preview[\w-]*\.spec\.ts$/.test(name))
	.sort();

test('the Shells preview spec runs once, in the reports package, under the entity preview config', () => {
	const path = 'packages/reports/test/entity-preview-shells.spec.ts';
	const listed = spawnSync(
		'bun',
		[
			'x',
			'playwright',
			'test',
			'--config',
			'src/configs/development-tooling/shellPlaywrightConfig.ts',
			'--grep',
			'reports.component.verification-evidence-video-evidence at',
			'--list'
		],
		{
			cwd: resolve('packages/reports'),
			env: { ...ownEnvironment(), PLAYWRIGHT_BROWSERS_PATH: '/unavailable-harness-browser' },
			encoding: 'utf8',
			timeout: 20000
		}
	);
	expect(
		listed.status,
		'the governed shell config must discover its real catalog video cases'
	).toBe(0);
	expect(listed.stdout).toContain('3 tests in 1 file');
	expect(existsSync(path)).toBe(true);
	expect(planned(path)).toEqual([
		{
			cwd: 'packages/reports',
			target: path,
			runner: 'playwright',
			command: preview('entity-preview-shells.spec.ts'),
			timeoutMs: config.timeouts.test
		}
	]);
});

test('every entity preview spec of the reports package is run by the config that finds it', () => {
	assertPlainSetupImports();
	expect(previews).toEqual([
		'entity-preview-actions.spec.ts',
		'entity-preview-captures.spec.ts',
		'entity-preview-contract.spec.ts',
		'entity-preview-groups.spec.ts',
		'entity-preview-marks.spec.ts',
		'entity-preview-metric-diff.spec.ts',
		'entity-preview-platforms.spec.ts',
		'entity-preview-shells.spec.ts',
		'entity-preview-source.spec.ts',
		'entity-preview-test-cases.spec.ts',
		'entity-preview-words.spec.ts',
		'entity-preview.spec.ts'
	]);
	for (const spec of previews)
		expect([spec, planned(`packages/reports/test/${spec}`)[0].command]).toEqual([
			spec,
			plannedPreview(spec)
		]);
});

/** Setup data must load before Vite, Vitest or a browser has installed renderer hooks. */
function assertPlainSetupImports() {
	const entries = config.setup.flatMap(({ command }) =>
		[...command.matchAll(/\bimport setup from ['"]([^'"]+)['"]/g)].map((match) => ({
			entry: match[1],
			cwd: resolve(/^cd ([^ ]+) &&/.exec(command)?.[1] ?? '.')
		}))
	);
	expect(entries.length).toBeGreaterThan(0);
	for (const { entry, cwd } of entries) {
		const env = Object.fromEntries(
			Object.entries(ownEnvironment()).filter(([name]) => !name.startsWith('VITEST'))
		);
		const ran = spawnSync(
			'bun',
			[
				'-e',
				`const entry = await import(${JSON.stringify(entry)}); console.log(typeof entry.default);`
			],
			{
				cwd,
				env: { ...env, PLAYWRIGHT_BROWSERS_PATH: '/unavailable-harness-browser' },
				encoding: 'utf8',
				timeout: 15000
			}
		);
		expect(
			[ran.status, ran.stdout.trim()],
			`${entry} must import without renderer or Vitest state: ${ran.stderr}`
		).toEqual([0, 'function']);
	}
}

test('capture readiness runs under the server-free shell config', async () => {
	const path = 'packages/reports/tests/e2e/explorer-shell-capture-readiness.spec.ts';
	expect(existsSync(path)).toBe(true);
	expect(planned(path)[0].command).toBe(
		'bun x playwright test --config src/configs/shellPlaywrightConfig.ts tests/e2e/explorer-shell-capture-readiness.spec.ts'
	);
	try {
		vi.stubEnv('PLAYWRIGHT_BROWSERS_PATH', '/unavailable-harness-unit-browser');
		await measureWorkload(
			'reports.config.shell-vite',
			'fixture-config-alias-admission',
			async () => {
				for (const page of ['navbar', 'components']) {
					vi.stubEnv('SHELL_FIXTURE_PAGE', page);
					const loaded = await loadConfigFromFile(
						{ command: 'build', mode: 'production' },
						resolve('packages/reports/src/configs/development-tooling/shellViteConfig.ts')
					);
					expect(loaded, `${page} configuration loads in its normal Vite runner`).not.toBeNull();
					const rendered = loaded!.config;
					if (page === 'navbar') expect(rendered.resolve).toBeUndefined();
					else
						expect(
							Object.fromEntries(
								Object.entries(rendered.resolve?.alias ?? {}).map(([name, target]) => [
									name,
									resolve(String(target))
								])
							)
						).toMatchObject({
							$shared: resolve('packages/reports/src/components'),
							$reports: resolve('packages/reports/src'),
							$desktop: resolve('packages/desktop/src')
						});
				}
			}
		);
	} finally {
		vi.unstubAllEnvs();
	}
});

test('an ordinary reports end-to-end spec keeps the default Playwright config', () => {
	const path = 'packages/reports/tests/e2e/harness-explorer-routes.spec.ts';
	expect(existsSync(path)).toBe(true);
	expect(planned(path)).toEqual([
		{
			cwd: 'packages/reports',
			target: path,
			runner: 'playwright',
			command: 'bun x playwright test tests/e2e/harness-explorer-routes.spec.ts',
			timeoutMs: config.timeouts.test
		}
	]);
});
