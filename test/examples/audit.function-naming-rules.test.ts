import { test } from 'vitest';
import type { AuditFile } from '../../src/audit/development-tooling/adapters/types';
import {
	auditFunctionNames,
	hasNamedValueExport
} from '../../src/audit/development-tooling/functionNamingRules';
import { recordExampleCases } from '../support/recordExampleCases';
import { expect } from '../verificationExpect';

const limits: AuditFile['limits'] = {
	maxFileLines: 220,
	maxFunctionLines: 55,
	maxClassLines: 120,
	maxMethodLines: 35,
	maxNestingDepth: 4,
	maxParameters: 4,
	maxComplexity: 10,
	maxClassesPerFile: 1
};

function makeAuditFile(
	relativePath: string,
	extension: string,
	structuralLines: string[]
): AuditFile {
	const contents = structuralLines.join('\n');
	return {
		absolutePath: `/workspace/project/${relativePath}`,
		relativePath,
		extension,
		contents,
		lines: [...structuralLines],
		structuralLines,
		limits,
		size: contents.length
	};
}

function summarizeFile(file: AuditFile) {
	return {
		relativePath: file.relativePath,
		extension: file.extension,
		structuralLines: file.structuralLines
	};
}

const functionNamingExamples = [
	{
		name: 'Flags invalid declaration and arrow names in a TypeScript utility',
		file: makeAuditFile('src/utils/format.ts', '.ts', [
			'export function FormatDate(value) { return value; }',
			'export function GET() { return value; }',
			'const formatDate = (value) => value;',
			"const BuildReport = () => ({ id: 'rpt_7f3a2d1c' });"
		])
	},
	{
		name: 'Allows PascalCase declarations and arrows in JSX components',
		file: makeAuditFile('src/components/ReportPanel.jsx', '.jsx', [
			'export function ReportPanel() { return null; }',
			'const RenderSummary = () => null;'
		])
	},
	{
		name: 'Allows PascalCase declarations and arrows in TSX components',
		file: makeAuditFile('src/components/ReportPanel.tsx', '.tsx', [
			'export function ReportPanel() { return null; }',
			'const RenderSummary = () => null;'
		])
	},
	{
		name: 'Allows HTTP verbs in route files and flags other PascalCase names',
		file: makeAuditFile('src/routes/api/+server.ts', '.ts', [
			"export function GET() { return new Response('ok'); }",
			"export const POST = async () => new Response('ok');",
			"export function HandleRequest() { return new Response('ok'); }"
		])
	}
];

const expectedFunctionNamingFindings = [
	[
		{
			path: 'src/utils/format.ts',
			rule: 'function-name-pattern',
			message: 'Function "FormatDate" should use camelCase.'
		},
		{
			path: 'src/utils/format.ts',
			rule: 'function-name-pattern',
			message: 'Function "GET" should use camelCase.'
		},
		{
			path: 'src/utils/format.ts',
			rule: 'function-name-pattern',
			message: 'Function "BuildReport" should use camelCase.'
		}
	],
	[],
	[],
	[
		{
			path: 'src/routes/api/+server.ts',
			rule: 'function-name-pattern',
			message: 'Function "HandleRequest" should use camelCase.'
		}
	]
];

test('Audits recognized function names and file exceptions', () => {
	const cases = functionNamingExamples.map(({ name, file }) => ({
		name,
		input: summarizeFile(file),
		output: auditFunctionNames(file)
	}));

	expect(cases.map(({ output }) => output)).toEqual(expectedFunctionNamingFindings);
	recordExampleCases(
		{
			unitId: 'audit.function-naming-rules',
			symbol: 'auditFunctionNames',
			state: 'audits-recognized-function-names-and-file-exceptions',
			evidence: 'examples-cases',
			file: 'audits-recognized-function-names-and-file-exceptions.json'
		},
		cases
	);
});

const exportLines = [
	'export async function buildReport() {}',
	"export const reportId = 'rpt_7f3a2d1c';",
	'export { normalizeName as toCamelCase };',
	'export type { NameOptions };'
];

const exportExamples = [
	{
		name: 'Finds an asynchronous exported function declaration',
		exportName: 'buildReport',
		expected: true
	},
	{
		name: 'Finds an exported const value',
		exportName: 'reportId',
		expected: true
	},
	{
		name: 'Finds the final name of a forwarded value export',
		exportName: 'toCamelCase',
		expected: true
	},
	{
		name: 'Ignores a type-only export when looking for a runtime value',
		exportName: 'NameOptions',
		expected: false
	}
];

test('Detects named runtime exports and skips type-only exports', () => {
	const cases = exportExamples.map(({ name, exportName }) => ({
		name,
		input: { lines: exportLines, name: exportName },
		output: hasNamedValueExport(exportLines, exportName)
	}));

	expect(cases.map(({ output }) => output)).toEqual(exportExamples.map(({ expected }) => expected));
	recordExampleCases(
		{
			unitId: 'audit.function-naming-rules',
			symbol: 'hasNamedValueExport',
			state: 'detects-named-runtime-exports-and-skips-type-only-exports',
			evidence: 'examples-cases',
			file: 'detects-named-runtime-exports-and-skips-type-only-exports.json'
		},
		cases
	);
});
