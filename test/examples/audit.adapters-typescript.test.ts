import { extname } from 'node:path';
import { test } from 'vitest';
import type { AuditFile, AuditStructure } from '../../src/audit/development-tooling/adapters/types';
import { typeScriptAdapter } from '../../src/audit/development-tooling/adapters/typescript';
import { maskTemplateLiterals, splitLines } from '../../src/audit/development-tooling/commonRules';
import type { AuditFinding } from '../../src/audit/development-tooling/types';
import { harnessRuleLimits } from '../../src/rules/explorer-ui/catalog';
import { recordExampleCases } from '../support/recordExampleCases';
import { expect } from '../verificationExpect';

/**
 * The TypeScript and JavaScript adapter is called the way the project auditor calls it. Each file
 * is split into the lines the rules read, then audit(file) returns its findings. Its declared
 * auditStructure is called with a project's file and folder lists. What it was given and what it
 * returned is asserted and recorded as the cases of its state.
 */

type Outcome = { name: string; input: unknown; output: AuditFinding[] };

const text = (...lines: string[]) => lines.join('\n');
const ruleAndPath = (findings: AuditFinding[]) =>
	findings.map(({ rule, path }) => `${rule} ${path}`);

const formatTotal = text(
	'export function formatTotal(amount: number, currency: string): string {',
	'\treturn currency + amount.toFixed(2);',
	'}'
);
const oversizedModule = Array.from(
	{ length: 230 },
	(_, index) => `export const label${index} = ${index};`
).join('\n');
const commandWithTwoClasses = text(
	"import { renderReport } from '../templates/report';",
	'',
	'export interface BuildOptions {',
	'\toutput: string;',
	'}',
	'',
	'export class BuildReportCommand {',
	'\trun(options: BuildOptions, dryRun: boolean, verbose: boolean, retries: number, label: string): string {',
	'\t\treturn renderReport(options.output);',
	'\t}',
	'}',
	'',
	'export class BuildCache {',
	'\tsize = 0;',
	'}'
);
const pascalFunction = text(
	'export function FormatTotal(amount: number): string {',
	'\treturn amount.toFixed(2);',
	'}'
);
const componentBody = "export const label = 'Save';";
const scaffold: AuditStructure = {
	profile: 'app',
	files: [
		'package.json',
		'src/app.html',
		'src/index.ts',
		'src/components/Button.tsx',
		'test/utils/format.test.ts'
	],
	dirs: ['src', 'src/components', 'test', 'test/utils']
};
const outsideCatalog: AuditStructure = {
	profile: 'app',
	files: ['src/index.ts', 'src/widgets/Card.tsx'],
	dirs: ['src', 'src/widgets']
};
const rootHelper: AuditStructure = {
	profile: 'lib',
	files: ['package.json', 'helper.ts'],
	dirs: []
};

/** The file the auditor builds after reading a project file, with the fields the rules read. */
function fileAt(
	relativePath: string,
	contents: string,
	extension = extname(relativePath)
): AuditFile {
	return {
		absolutePath: `/example-project/${relativePath}`,
		relativePath,
		extension,
		contents,
		lines: splitLines(contents),
		structuralLines: splitLines(maskTemplateLiterals(contents)),
		limits: harnessRuleLimits,
		size: Buffer.byteLength(contents)
	};
}

/** audit(file) for one project file, recorded with the path and contents it was given. */
function auditCase(
	name: string,
	relativePath: string,
	contents: string,
	extension?: string
): Outcome {
	const output = typeScriptAdapter.audit(fileAt(relativePath, contents, extension));
	return { name, input: { relativePath, contents }, output };
}

/** The declared auditStructure, called with a project's file and folder lists. */
function structureCase(name: string, structure: AuditStructure): Outcome {
	if (!typeScriptAdapter.auditStructure) {
		throw new Error('typeScriptAdapter declares no auditStructure');
	}
	return { name, input: structure, output: typeScriptAdapter.auditStructure(structure) };
}

test('audit returns the rule findings of a TypeScript file in contract order', () => {
	const clean = auditCase('a small utility module', 'src/utils/formatTotal.ts', formatTotal);
	const oversized = {
		name: 'a library module of 230 lines',
		input: { relativePath: 'src/lib/labels.ts', lines: 230 },
		output: typeScriptAdapter.audit(fileAt('src/lib/labels.ts', oversizedModule))
	};
	const mixed = auditCase(
		'a command module with two classes, a five-parameter method, an interface and a template import',
		'src/commands/BuildReportCommand.ts',
		commandWithTwoClasses
	);
	const pascal = auditCase(
		'a function named in PascalCase',
		'scripts/format-totals.ts',
		pascalFunction
	);
	expect(clean.output).toEqual([]);
	expect(ruleAndPath(oversized.output)).toEqual(['small-file src/lib/labels.ts']);
	expect(ruleAndPath(mixed.output)).toEqual([
		'max-classes-per-file src/commands/BuildReportCommand.ts',
		'max-parameters src/commands/BuildReportCommand.ts',
		'thin-command-modules src/commands/BuildReportCommand.ts',
		'separate-type-declarations src/commands/BuildReportCommand.ts'
	]);
	expect(ruleAndPath(pascal.output)).toEqual(['function-name-pattern scripts/format-totals.ts']);
	recordExampleCases(
		{
			unitId: 'audit.adapters-typescript',
			symbol: 'typeScriptAdapter.audit',
			state: 'audit-returns-the-rule-findings-of-a-typescript-file-in-cont',
			evidence: 'examples-cases',
			file: 'audit-returns-the-rule-findings-of-a-typescript-file-in-cont.json'
		},
		[clean, oversized, mixed, pascal]
	);
});

test('audit reports react-component-name only for a tsx or jsx file whose name is not PascalCase', () => {
	const cases = [
		auditCase('a tsx file named in PascalCase', 'src/components/Button.tsx', componentBody),
		auditCase('a jsx file with a lowercase name', 'src/components/todo-list.jsx', componentBody),
		auditCase('a name that still contains a dot', 'src/components/Card.test.tsx', componentBody),
		auditCase('an empty name with the tsx extension', '.tsx', componentBody, '.tsx')
	];
	expect(cases.map(({ output }) => ruleAndPath(output))).toEqual([
		[],
		['react-component-name src/components/todo-list.jsx'],
		[],
		[]
	]);
	recordExampleCases(
		{
			unitId: 'audit.adapters-typescript',
			symbol: 'typeScriptAdapter.audit',
			state: 'audit-reports-react-component-name-only-for-a-tsx-or-jsx-fil',
			evidence: 'examples-cases',
			file: 'audit-reports-react-component-name-only-for-a-tsx-or-jsx-fil.json'
		},
		cases
	);
});

test('auditStructure reports folders and root files outside the Harness scaffold catalog', () => {
	const cases = [
		structureCase('a scaffolded app with components, utils and tests', scaffold),
		structureCase('a source folder outside the scaffold catalog', outsideCatalog),
		structureCase('a root TypeScript file that is not a config', rootHelper)
	];
	expect(cases.map(({ output }) => ruleAndPath(output))).toEqual([
		[],
		['harness-source-structure src/widgets', 'harness-source-structure src/widgets/Card.tsx'],
		['harness-root-file-structure helper.ts']
	]);
	recordExampleCases(
		{
			unitId: 'audit.adapters-typescript',
			symbol: 'typeScriptAdapter.auditStructure',
			state: 'auditstructure-reports-folders-and-root-files-outside-the-ha',
			evidence: 'examples-cases',
			file: 'auditstructure-reports-folders-and-root-files-outside-the-ha.json'
		},
		cases
	);
});
