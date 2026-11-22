import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { reportsEnvironment } from '../../src/cli/program/run-report/reportsEnvironment';

const variableNames = [
	'HARNESS_REPORTS_SETTINGS_FILE',
	'PROJECT_REPORTS_CONFIG_FILE',
	'PROJECT_REPORTS_CLOUDFLARE_CONFIG_HOME'
] as const;

function withReportEnvironment<T>(
	values: Partial<Record<(typeof variableNames)[number], string>>,
	use: () => T
): T {
	const previous = variableNames.map((name) => [name, process.env[name]] as const);
	for (const name of variableNames) delete process.env[name];
	Object.assign(process.env, values);
	try {
		return use();
	} finally {
		for (const [name, value] of previous) {
			if (value === undefined) delete process.env[name];
			else process.env[name] = value;
		}
	}
}

function summarizeEnvironment(environment: typeof process.env) {
	return {
		configFile: environment.PROJECT_REPORTS_CONFIG_FILE,
		cloudflareConfigHome: environment.PROJECT_REPORTS_CLOUDFLARE_CONFIG_HOME
	};
}

test('Settings file supplies unset report environment values', async () => {
	await withTempDir('reports-environment-settings-', (directory) => {
		const settingsFile = join(directory, 'report-settings.json');
		writeFileSync(settingsFile, JSON.stringify({
			configFile: '/workspace/project/reports/report.config.json',
			cloudflareConfigHome: '/workspace/ci-user/.config/cloudflare'
		}));
		const input = { settingsFile };
		const output = withReportEnvironment(
			{ HARNESS_REPORTS_SETTINGS_FILE: settingsFile },
			() => summarizeEnvironment(reportsEnvironment())
		);
		expect(output).toEqual({
			configFile: '/workspace/project/reports/report.config.json',
			cloudflareConfigHome: '/workspace/ci-user/.config/cloudflare'
		});
		recordExampleCases(
			{
				unitId: 'function.reports-environment',
				symbol: 'reportsEnvironment',
				state: 'settings-file-supplies-unset-report-environment-values',
				evidence: 'examples-cases',
				file: 'settings-file-supplies-unset-report-environment-values.json'
			},
			[{ name: 'settings fill both unset keys', input, output }]
		);
	});
});

test('Explicit values override settings including empty strings', async () => {
	await withTempDir('reports-environment-overrides-', (directory) => {
		const settingsFile = join(directory, 'report-settings.json');
		writeFileSync(settingsFile, JSON.stringify({
			configFile: '/settings/report.json',
			cloudflareConfigHome: '/settings/cloudflare'
		}));
		const input = {
			settingsFile,
			configOverride: '',
			cloudflareOverride: '/workspace/user/.config/cloudflare'
		};
		const output = withReportEnvironment(
			{
				HARNESS_REPORTS_SETTINGS_FILE: settingsFile,
				PROJECT_REPORTS_CONFIG_FILE: '',
				PROJECT_REPORTS_CLOUDFLARE_CONFIG_HOME: input.cloudflareOverride
			},
			() => summarizeEnvironment(reportsEnvironment())
		);
		expect(output).toEqual({ configFile: '', cloudflareConfigHome: input.cloudflareOverride });
		recordExampleCases(
			{
				unitId: 'function.reports-environment',
				symbol: 'reportsEnvironment',
				state: 'explicit-values-override-settings-including-empty-strings',
				evidence: 'examples-cases',
				file: 'explicit-values-override-settings-including-empty-strings.json'
			},
			[{ name: 'explicit empty and nonempty values win', input, output }]
		);
	});
});

test('Missing settings file preserves undefined report keys', () => {
	const input = { settingsFile: '/missing/report-settings.json' };
	const output = withReportEnvironment(
		{ HARNESS_REPORTS_SETTINGS_FILE: input.settingsFile },
		() => summarizeEnvironment(reportsEnvironment())
	);
	expect(output).toEqual({ configFile: undefined, cloudflareConfigHome: undefined });
	recordExampleCases(
		{
			unitId: 'function.reports-environment',
			symbol: 'reportsEnvironment',
			state: 'missing-settings-file-preserves-undefined-report-keys',
			evidence: 'examples-cases',
			file: 'missing-settings-file-preserves-undefined-report-keys.json'
		},
		[{ name: 'missing file has no report settings', input, output }]
	);
});
