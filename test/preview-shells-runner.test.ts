import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { expect, test } from 'vitest';
import { unitsConfigFile, unitsConfigSchema } from '../src/core/unitsConfig';
import { verifyConfigFile, verifyConfigSchema } from '../src/core/verifyTypes';
import { verifyPlan } from '../src/services/verification-service/verifyPlan';

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

test('capture readiness runs under the server-free shell config', () => {
	const path = 'packages/reports/tests/e2e/explorer-shell-capture-readiness.spec.ts';
	expect(existsSync(path)).toBe(true);
	expect(planned(path)[0].command).toBe(
		'bun x playwright test --config src/configs/shellPlaywrightConfig.ts tests/e2e/explorer-shell-capture-readiness.spec.ts'
	);
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
