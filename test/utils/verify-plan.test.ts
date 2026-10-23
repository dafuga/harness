import { expect, test } from 'vitest';
import { unitsConfigSchema } from '../../src/core/unitsConfig';
import { defaultVerifyConfig, verifyConfigSchema } from '../../src/core/verifyTypes';
import { verifyPlan } from '../../src/services/verification-service/verifyPlan';

const unitsConfig = unitsConfigSchema.parse({
	schemaVersion: 1,
	workspaces: [
		{ name: '', root: '.' },
		{ name: 'reports', root: 'packages/reports' }
	],
	tests: ['test/', 'tests/'],
	global: [],
	ignored: [],
	references: []
});
const picker = 'packages/reports/tests/e2e/provider-picker.spec.ts';
const selectedTests = ['test/utils/case.test.ts', 'packages/reports/tests/e2e/hub.spec.ts', picker];
const planned = (config = defaultVerifyConfig) =>
	verifyPlan({ selectedTests, scenarios: [], config, unitsConfig }).map((check) => ({
		id: check.id,
		cwd: check.cwd,
		command: check.command,
		timeoutMs: check.timeoutMs
	}));

test('a selected test file runs under the runner its name implies, in its workspace', () => {
	expect(planned()).toEqual([
		{
			id: 'packages/reports/tests/e2e/hub.spec.ts',
			cwd: 'packages/reports',
			command: 'bun x playwright test tests/e2e/hub.spec.ts',
			timeoutMs: 600_000
		},
		{
			id: picker,
			cwd: 'packages/reports',
			command: 'bun x playwright test tests/e2e/provider-picker.spec.ts',
			timeoutMs: 600_000
		},
		{
			id: 'test/utils/case.test.ts',
			cwd: '.',
			command: 'bun x vitest run test/utils/case.test.ts',
			timeoutMs: 600_000
		}
	]);
});

test('a test file that needs its own command gets it, and every other file keeps its runner', () => {
	const config = verifyConfigSchema.parse({
		...defaultVerifyConfig,
		checks: [
			{
				path: picker,
				command: 'bun x playwright test --config src/configs/pickerPlaywrightConfig.ts {target}',
				timeoutMs: 120_000
			}
		]
	});
	const [hub, own, unit] = planned(config);
	expect(own).toEqual({
		id: picker,
		cwd: 'packages/reports',
		command:
			'bun x playwright test --config src/configs/pickerPlaywrightConfig.ts tests/e2e/provider-picker.spec.ts',
		timeoutMs: 120_000
	});
	expect([hub.command, unit.command]).toEqual([
		'bun x playwright test tests/e2e/hub.spec.ts',
		'bun x vitest run test/utils/case.test.ts'
	]);
	// A declared command names a tracked test file, never a pattern.
	const invalid = { ...defaultVerifyConfig, checks: [{ path: '', command: 'true' }] };
	expect(verifyConfigSchema.safeParse(invalid).success).toBe(false);
});
