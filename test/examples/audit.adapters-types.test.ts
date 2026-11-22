import type {
	AdapterCoverage,
	AuditAdapter,
	AuditConfig,
	AuditCoverage,
	AuditFile,
	AuditIgnore,
	AuditOptions,
	AuditProfile,
	AuditResult,
	AuditStructure
} from '../../src/audit/development-tooling/adapters/types';
import type { AuditFinding } from '../../src/audit/development-tooling/types';
import type { HarnessRuleLimits } from '../../src/rules/explorer-ui/catalog.types';
import { recordExampleCases } from '../support/recordExampleCases';
import { expect } from '../verificationExpect';
import { test } from 'vitest';

const profiles: AuditProfile[] = ['app', 'auto', 'dapp', 'lib'];
const options: AuditOptions = { profile: 'app', cleanCode: { enabled: true } };
const limits: HarnessRuleLimits = {
	maxFileLines: 220,
	maxFunctionLines: 55,
	maxClassLines: 120,
	maxMethodLines: 35,
	maxNestingDepth: 4,
	maxParameters: 4,
	maxComplexity: 10,
	maxClassesPerFile: 1
};
const ignored: AuditIgnore = {
	path: 'src/generated.ts',
	rule: 'file-size',
	reason: 'Generated source is maintained by the build.'
};
const config: AuditConfig = {
	cleanCode: { mode: 'advisory' },
	ignore: [ignored],
	limits: { maxFileLines: 180 }
};
const file: AuditFile = {
	absolutePath: '/workspace/src/example.ts',
	relativePath: 'src/example.ts',
	extension: '.ts',
	contents: 'export const answer = 42;',
	lines: ['export const answer = 42;'],
	structuralLines: ['export const answer = 42;'],
	limits,
	size: 25
};
const finding: AuditFinding = {
	path: file.relativePath,
	rule: 'file-size',
	message: 'File exceeds the configured line limit.'
};
const structure: AuditStructure = {
	moduleSourceFolders: ['src'],
	root: '/workspace',
	profile: 'app',
	files: [file.relativePath],
	dirs: ['src']
};
const adapter: AuditAdapter = {
	id: 'typescript',
	label: 'TypeScript',
	profiles: ['app', 'lib'],
	extensions: ['.ts', '.tsx'],
	optionalTools: ['tsc'],
	audit: (candidate) => (candidate.extension === '.ts' ? [finding] : []),
	auditStructure: (candidate) => (candidate.dirs.includes('src') ? [] : [finding])
};
const adapterCoverage: AdapterCoverage = {
	id: adapter.id,
	label: adapter.label,
	files: [file.relativePath],
	extensions: adapter.extensions,
	optionalTools: adapter.optionalTools
};
const coverage: AuditCoverage = {
	profile: 'app',
	adapters: [adapterCoverage],
	coveredFiles: [file.relativePath],
	ignoredPaths: [ignored.path],
	ignoredFindings: [],
	unknownFiles: []
};

test('Represents adapter audit inputs and coverage', () => {
	const result: AuditResult = {
		findings: adapter.audit(file),
		coverage
	};
	const summary = {
		profiles,
		selectedProfile: options.profile,
		ignoredPath: config.ignore?.[0]?.path,
		findingPaths: result.findings.map(({ path }) => path),
		coveredFiles: result.coverage.coveredFiles,
		unknownFiles: result.coverage.unknownFiles,
		structureDirs: structure.dirs,
		structureFindings: adapter.auditStructure?.(structure).length
	};

	expect(summary).toEqual({
		profiles: ['app', 'auto', 'dapp', 'lib'],
		selectedProfile: 'app',
		ignoredPath: 'src/generated.ts',
		findingPaths: ['src/example.ts'],
		coveredFiles: ['src/example.ts'],
		unknownFiles: [],
		structureDirs: ['src'],
		structureFindings: 0
	});
	recordExampleCases(
		{
			unitId: 'audit.adapters-types',
			symbol: 'AuditAdapter',
			state: 'represents-adapter-audit-inputs-and-coverage',
			evidence: 'examples-cases',
			file: 'represents-adapter-audit-inputs-and-coverage.json'
		},
		[
			{
				name: 'TypeScript audit inputs and covered file',
				input: {
					profile: options.profile,
					file: { path: file.relativePath, extension: file.extension },
					structure: { profile: structure.profile, dirs: structure.dirs },
					ignoredPath: ignored.path
				},
				output: summary
			}
		]
	);
});
