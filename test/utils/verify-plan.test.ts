import { expect, test } from 'vitest';
import { unitsConfigSchema } from '../../src/core/unitsConfig';
import { defaultVerifyConfig, verifyConfigSchema } from '../../src/core/verifyTypes';
import { verifyPlan } from '../../src/workflows/verification-evidence/run-verify/verification-service/verifyPlan';

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
				command:
					'bun x playwright test --config src/configs/development-tooling/pickerPlaywrightConfig.ts {target}',
				timeoutMs: 120_000
			}
		]
	});
	const [hub, own, unit] = planned(config);
	expect(own).toEqual({
		id: picker,
		cwd: 'packages/reports',
		command:
			'bun x playwright test --config src/configs/development-tooling/pickerPlaywrightConfig.ts tests/e2e/provider-picker.spec.ts',
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

test('old configs without profiles remain valid and default to an empty profile map', () => {
	const config = verifyConfigSchema.parse({
		schemaVersion: 1,
		setup: [],
		link: [],
		runners: defaultVerifyConfig.runners,
		checks: [{ path: 'test/legacy.test.ts', command: 'bun x vitest run {target}' }],
		timeouts: { test: 5_000 }
	});
	expect(config.profiles).toEqual({});
	expect(config.checks).toMatchObject([
		{ path: 'test/legacy.test.ts', command: 'bun x vitest run {target}' }
	]);
});

test('profile defaults expand and explicit check fields override them', () => {
	const config = verifyConfigSchema.parse({
		...defaultVerifyConfig,
		profiles: {
			focused: { command: 'bun x vitest run {target} --testTimeout 20000', timeoutMs: 90_000 }
		},
		checks: [
			{ path: 'test/utils/case.test.ts', profile: 'focused' },
			{
				path: 'test/utils/other.test.ts',
				profile: 'focused',
				command: 'bun x vitest run {target} --reporter=dot',
				timeoutMs: 15_000
			},
			{ path: 'test/utils/command.test.ts', profile: 'focused', timeoutMs: 30_000 }
		]
	});
	expect(
		config.checks.map(({ path, command, timeoutMs }) => ({ path, command, timeoutMs }))
	).toEqual([
		{
			path: 'test/utils/case.test.ts',
			command: 'bun x vitest run {target} --testTimeout 20000',
			timeoutMs: 90_000
		},
		{
			path: 'test/utils/other.test.ts',
			command: 'bun x vitest run {target} --reporter=dot',
			timeoutMs: 15_000
		},
		{
			path: 'test/utils/command.test.ts',
			command: 'bun x vitest run {target} --testTimeout 20000',
			timeoutMs: 30_000
		}
	]);
});

test('unknown named profiles are rejected', () => {
	const result = verifyConfigSchema.safeParse({
		...defaultVerifyConfig,
		checks: [{ path: 'test/utils/case.test.ts', profile: 'missing' }]
	});
	expect(result.success).toBe(false);
	if (!result.success)
		expect(result.error.issues.map((issue) => issue.message)).toContain(
			'Unknown verify check profile "missing".'
		);
});

test('literal test file arguments must match check.path while placeholders and commands stay valid', () => {
	const mismatch = verifyConfigSchema.safeParse({
		...defaultVerifyConfig,
		checks: [
			{
				path: picker,
				command: 'bun x playwright test tests/e2e/different.spec.ts'
			}
		]
	});
	expect(mismatch.success).toBe(false);
	if (!mismatch.success)
		expect(mismatch.error.issues.map((issue) => issue.message)).toContain(
			`Command test path "tests/e2e/different.spec.ts" does not match check path "${picker}".`
		);
	const valid = verifyConfigSchema.parse({
		...defaultVerifyConfig,
		checks: [
			{
				path: picker,
				command: 'bun x playwright test --config src/config.ts provider-picker.spec.ts'
			},
			{ path: 'test/utils/case.test.ts', command: 'bun x vitest run {target}' },
			{ path: 'test/utils/custom.test.ts', command: 'bun run check:fast' }
		]
	});
	expect(valid.checks.map((check) => check.command)).toEqual([
		'bun x playwright test --config src/config.ts provider-picker.spec.ts',
		'bun x vitest run {target}',
		'bun run check:fast'
	]);
});
