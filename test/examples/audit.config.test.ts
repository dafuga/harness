import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'vitest';
import {
	filterIgnoredFindings,
	readAuditConfig
} from '../../src/audit/development-tooling/config';
import type { AuditFinding } from '../../src/audit/development-tooling/types';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { expect } from '../verificationExpect';

const defaultLimits = {
	maxFileLines: 220, maxFunctionLines: 55, maxClassLines: 120, maxMethodLines: 35,
	maxNestingDepth: 4, maxParameters: 4, maxComplexity: 10, maxClassesPerFile: 1
};
const suppliedConfig = {
	cleanCode: { mode: 'advisory', minConfidence: 0.9, exclude: ['src/generated/'] },
	ignore: [
		{ path: 'src/legacy/', rule: 'small-file', reason: 'Scheduled for the billing rewrite.' },
		{ path: '   ', reason: 'Blank paths are discarded.' }
	],
	limits: { maxFileLines: 300 }
};
const ignoreRules = [
	{ path: 'src/legacy/', rule: 'small-file', reason: 'Scheduled for the billing rewrite.' },
	{ path: 'src/reports/summary.ts', reason: 'Tracked in the reports cleanup.' }
];
const findings: AuditFinding[] = [
	{ path: 'src/legacy/parser.ts', rule: 'small-file', message: 'File has 340 lines. Limit is 300.' },
	{ path: 'src/legacy/parser.ts', rule: 'max-complexity', message: 'Complexity 14; limit 10.' },
	{ path: 'src/reports/summary.ts', rule: 'max-classes-per-file', message: '2 classes; limit 1.' },
	{ path: 'src/billing/invoices.ts', rule: 'small-file', message: '412 lines; limit 300.' }
];

function createProjectRoot(parent: string, name: string): string {
	const root = join(parent, name);
	mkdirSync(root, { recursive: true });
	return root;
}

function writeConfig(parent: string, name: string, config: object | string): string {
	const root = createProjectRoot(parent, name);
	const contents = typeof config === 'string' ? config : (JSON.stringify(config, null, 2) ?? 'null');
	writeFileSync(join(root, 'harness.audit.json'), contents);
	return root;
}

function errorSummary(call: () => unknown) {
	try {
		call();
		return { name: 'NoError', message: 'Call returned normally.' };
	} catch (error) {
		if (!(error instanceof Error)) return { name: typeof error, message: String(error) };
		const code = 'code' in error ? error.code : undefined;
		return {
			name: error.name,
			message: error.message,
			...(typeof code === 'string' ? { code } : {})
		};
	}
}

function findingSummary(items: AuditFinding[]) {
	return items.map(({ path, rule }) => ({ path, rule }));
}

function partitionSummary(result: ReturnType<typeof filterIgnoredFindings>) {
	return {
		activeFindings: findingSummary(result.activeFindings),
		ignoredFindings: findingSummary(result.ignoredFindings)
	};
}

test('reads defaults and normalizes configured audit settings', () =>
	withTempDir('audit-config-examples-', (directory) => {
		const defaultsRoot = createProjectRoot(directory, 'defaults');
		const defaults = readAuditConfig(defaultsRoot);
		const configuredRoot = writeConfig(directory, 'configured', suppliedConfig);
		const configured = readAuditConfig(configuredRoot);
		expect(defaults.cleanCode).toEqual({
			mode: 'off', model: 'jev-1.13.0', minConfidence: 0.85,
			apiKeyEnv: 'HARNESS_JEV_API_KEY', exclude: []
		});
		expect(defaults.ignore).toEqual([]);
		expect(defaults.limits).toEqual(defaultLimits);
		expect(configured).toMatchObject({
			cleanCode: {
				mode: 'advisory', model: 'jev-1.13.0', minConfidence: 0.9,
				apiKeyEnv: 'HARNESS_JEV_API_KEY', exclude: ['src/generated/']
			},
			ignore: [ignoreRules[0]],
			limits: { ...defaultLimits, maxFileLines: 300 }
		});
		recordExampleCases(
			{
				unitId: 'audit.config', symbol: 'readAuditConfig',
				state: 'reads-defaults-and-normalizes-configured-audit-settings',
				evidence: 'examples-cases',
				file: 'reads-defaults-and-normalizes-configured-audit-settings.json'
			},
			[
				{
					name: 'missing file returns built-in defaults',
					input: { root: defaultsRoot, file: null },
					output: defaults
				},
				{
					name: 'configured values are completed and blank ignores removed',
					input: { root: configuredRoot, file: suppliedConfig },
					output: configured
				}
			]
		);
	})
);

test('rejects invalid audit configuration', () =>
	withTempDir('audit-config-errors-', (directory) => {
		const limitConfig = { limits: { maxFileLines: 0 } };
		const limitRoot = writeConfig(directory, 'invalid-limit', limitConfig);
		const limitError = errorSummary(() => readAuditConfig(limitRoot));
		expect(limitError).toMatchObject({
			name: 'ExpectedCliError',
			message: 'harness.audit.json limits.maxFileLines must be a positive integer.'
		});
		const invalidJson = '{"cleanCode":';
		const syntaxRoot = writeConfig(directory, 'invalid-json', invalidJson);
		const syntaxError = errorSummary(() => readAuditConfig(syntaxRoot));
		expect(syntaxError.name).toBe('SyntaxError');
		const invalidIgnore = { ignore: [null] };
		const typeRoot = writeConfig(directory, 'invalid-ignore', invalidIgnore);
		const typeError = errorSummary(() => readAuditConfig(typeRoot));
		expect(typeError.name).toBe('TypeError');
		const directoryRoot = createProjectRoot(directory, 'directory-as-config');
		mkdirSync(join(directoryRoot, 'harness.audit.json'));
		const fileError = errorSummary(() => readAuditConfig(directoryRoot));
		expect(fileError).toMatchObject({ name: 'Error', code: 'EISDIR' });
		recordExampleCases(
			{
				unitId: 'audit.config', symbol: 'readAuditConfig',
				state: 'rejects-invalid-audit-configuration',
				evidence: 'examples-cases', file: 'rejects-invalid-audit-configuration.json'
			},
			[
				{
					name: 'invalid limit throws ExpectedCliError',
					input: { root: limitRoot, file: limitConfig },
					error: limitError
				},
				{
					name: 'malformed JSON passes through SyntaxError',
					input: { root: syntaxRoot, file: invalidJson },
					error: syntaxError
				},
				{
					name: 'null ignore entry throws TypeError',
					input: { root: typeRoot, file: invalidIgnore },
					error: typeError
				},
				{
					name: 'directory at config path passes through file system error',
					input: { root: directoryRoot, file: 'harness.audit.json directory' },
					error: fileError
				}
			]
		);
	})
);

test('partitions findings by configured ignore path and rule', () =>
	withTempDir('audit-config-filter-', (directory) => {
		const configRoot = writeConfig(directory, 'configured', { ignore: ignoreRules });
		const config = readAuditConfig(configRoot);
		const configuredResult = filterIgnoredFindings(findings, config);
		expect(partitionSummary(configuredResult)).toEqual({
			activeFindings: [
				{ path: 'src/legacy/parser.ts', rule: 'max-complexity' },
				{ path: 'src/billing/invoices.ts', rule: 'small-file' }
			],
			ignoredFindings: [
				{ path: 'src/legacy/parser.ts', rule: 'small-file' },
				{ path: 'src/reports/summary.ts', rule: 'max-classes-per-file' }
			]
		});
		const emptyConfig = readAuditConfig(createProjectRoot(directory, 'no-ignores'));
		const emptyResult = filterIgnoredFindings(findings, emptyConfig);
		expect(partitionSummary(emptyResult)).toEqual({
			activeFindings: findingSummary(findings),
			ignoredFindings: []
		});
		recordExampleCases(
			{
				unitId: 'audit.config', symbol: 'filterIgnoredFindings',
				state: 'partitions-findings-by-configured-ignore-path-and-rule',
				evidence: 'examples-cases',
				file: 'partitions-findings-by-configured-ignore-path-and-rule.json'
			},
			[
				{
					name: 'prefix rule and exact path ignores preserve result order',
					input: { findings, config: { ignore: config.ignore } },
					output: partitionSummary(configuredResult)
				},
				{
					name: 'empty ignore list keeps every finding active',
					input: { findings, config: { ignore: emptyConfig.ignore } },
					output: partitionSummary(emptyResult)
				}
			]
		);
	})
);
