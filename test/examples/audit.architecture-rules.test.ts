import { extname } from 'node:path';
import { test } from 'vitest';
import {
	auditArchitecture,
	auditTypePlacement
} from '../../src/audit/development-tooling/architectureRules';
import type { AuditFile } from '../../src/audit/development-tooling/adapters/types';
import type { AuditFinding } from '../../src/audit/development-tooling/types';
import { recordExampleCases } from '../support/recordExampleCases';
import { expect } from '../verificationExpect';

/**
 * The two functions of architectureRules are called as the TypeScript and Svelte adapters call
 * them: auditTypePlacement with an AuditFile, and auditArchitecture with a file's path and its
 * lines. What each was given and what it returned is asserted and recorded as the cases of its
 * state.
 */

type ExampleCase = Parameters<typeof recordExampleCases>[1][number];

const limits = {
	maxFileLines: 220,
	maxFunctionLines: 55,
	maxClassLines: 120,
	maxMethodLines: 35,
	maxNestingDepth: 4,
	maxParameters: 4,
	maxComplexity: 10,
	maxClassesPerFile: 1
};

/** An AuditFile for a made-up file; the rules read only its relativePath, extension and contents. */
function sourceFile(relativePath: string, lines: string[]): AuditFile {
	const contents = `${lines.join('\n')}\n`;
	const split = contents.split('\n');
	return {
		absolutePath: `/srv/app/${relativePath}`,
		relativePath,
		extension: extname(relativePath),
		contents,
		lines: split,
		structuralLines: split,
		limits,
		size: contents.length
	};
}

/** auditTypePlacement called with one file, recorded with the fields it reads. */
function placed(name: string, file: AuditFile): ExampleCase {
	const { relativePath, extension, contents } = file;
	return { name, input: { relativePath, extension, contents }, output: auditTypePlacement(file) };
}

/** auditArchitecture called with one importing file's path and its lines. */
function imported(name: string, file: { path: string; lines: string[] }): ExampleCase {
	return { name, input: file, output: auditArchitecture(file.path, file.lines) };
}

const declaredType = (path: string, name: string): AuditFinding => ({
	path,
	rule: 'separate-type-declarations',
	message: `Move ${name} to a sibling .types.ts file and import its type.`
});

const typesFileRuntime = (path: string): AuditFinding => ({
	path,
	rule: 'separate-type-declarations',
	message:
		'Keep runtime implementations outside type files; retain type-only declarations and compatibility re-exports here.'
});

const coreMessage = 'Core modules cannot import templates, workflows, or commands.';
const templateMessage = 'Template modules cannot import workflows or commands.';
const commandMessage =
	'Command modules should delegate instead of importing templates or file-generation helpers.';

/** A boundary finding worded as the rules word it, naming the line the import starts on. */
const boundary = (path: string, rule: string, message: string, line: number): AuditFinding => ({
	path,
	rule,
	message: `${message} Import starts near line ${line}.`
});

const reportsPath = 'src/core/reports.ts';
const reports = sourceFile(reportsPath, [
	'export interface ReportOptions {',
	'\tlimit: number;',
	'}',
	'',
	'export function reportLimit(options: ReportOptions): number {',
	'\ttype Limit = number;',
	'\tconst limit: Limit = options.limit;',
	'\treturn limit;',
	'}'
]);
const badge = sourceFile('src/components/explorer/StatusBadge.svelte', [
	'<script lang="ts">',
	'\tinterface Props {',
	'\t\tlabel: string;',
	'\t}',
	'',
	'\tlet { label }: Props = $props();',
	'</script>',
	'',
	'<span>{label}</span>'
]);
const typesWithRuntime = sourceFile('src/core/reports.types.ts', [
	'export interface ReportOptions {',
	'\tlimit: number;',
	'}',
	'',
	'export function reportLimit(options: ReportOptions): number {',
	'\treturn options.limit;',
	'}'
]);
const ambient = sourceFile('src/core/limits.ts', [
	'export interface Limits {',
	'\tmax: number;',
	'}',
	'',
	'export declare const defaultLimits: Limits;'
]);

const coreFile = {
	path: 'src/core/files.ts',
	lines: [
		"import { renderTemplate } from '../templates/render';",
		"import { joinPath } from './paths';",
		"import '../workflows/register';",
		"import { templateNames } from '../templates';",
		'',
		"export const coreName = joinPath(renderTemplate('core'));"
	]
};
const commandFile = {
	path: 'src/commands/module-system/ModuleCommand.ts',
	lines: [
		"import { loadFiles } from '../../core/files';",
		"import { renderTemplate } from '../../templates/render';",
		"import { templateNames } from '../../templates';",
		'',
		'export function runModule(): void {',
		'\tloadFiles();',
		'}'
	]
};
const templateFile = {
	path: 'src/templates/development-tooling/scaffoldTypes.ts',
	lines: [
		"import { runWorkflow } from '../../workflows/runWorkflow';",
		'',
		'export const templateNames: string[] = [];'
	]
};
const cliFile = {
	path: 'src/cli/index.ts',
	lines: [
		"import { runModule } from '../commands/module-system/ModuleCommand';",
		'',
		'runModule();'
	]
};

test('auditTypePlacement reports types and runtime sharing a file', () => {
	const cases = [
		placed('reports.ts declares an interface, and a type alias nested in a function', reports),
		placed('StatusBadge.svelte declares Props in its script block', badge),
		placed('reports.types.ts declares types and also a runtime function', typesWithRuntime),
		placed('limits.ts declares types and a declare statement, which is not runtime', ambient)
	];
	expect(cases.map((item) => item.output)).toEqual([
		[declaredType(reportsPath, 'ReportOptions'), declaredType(reportsPath, 'Limit')],
		[declaredType('src/components/explorer/StatusBadge.svelte', 'Props')],
		[typesFileRuntime('src/core/reports.types.ts')],
		[]
	]);
	recordExampleCases(
		{
			unitId: 'audit.architecture-rules',
			symbol: 'auditTypePlacement',
			state: 'audittypeplacement-reports-types-and-runtime-sharing-a-file',
			evidence: 'examples-cases',
			file: 'audittypeplacement-reports-types-and-runtime-sharing-a-file.json'
		},
		cases
	);
});

test('auditArchitecture flags boundary imports and passes the rest', () => {
	const cases = [
		imported('files.ts imports templates; sibling, side-effect and bare imports pass', coreFile),
		imported(
			'ModuleCommand.ts imports core files, templates and a bare templates folder',
			commandFile
		),
		imported('scaffoldTypes.ts imports workflows, which template modules may not', templateFile),
		imported('cli/index.ts imports a command, outside the folders the rules check', cliFile)
	];
	expect(cases.map((item) => item.output)).toEqual([
		[boundary(coreFile.path, 'architecture-boundaries', coreMessage, 1)],
		[
			boundary(commandFile.path, 'thin-command-modules', commandMessage, 1),
			boundary(commandFile.path, 'thin-command-modules', commandMessage, 2),
			boundary(commandFile.path, 'thin-command-modules', commandMessage, 3)
		],
		[boundary(templateFile.path, 'architecture-boundaries', templateMessage, 1)],
		[]
	]);
	recordExampleCases(
		{
			unitId: 'audit.architecture-rules',
			symbol: 'auditArchitecture',
			state: 'auditarchitecture-flags-boundary-imports-and-passes-the-rest',
			evidence: 'examples-cases',
			file: 'auditarchitecture-flags-boundary-imports-and-passes-the-rest.json'
		},
		cases
	);
});
