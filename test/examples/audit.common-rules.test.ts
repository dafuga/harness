import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'vitest';
import {
	auditClassCount,
	auditFileLength,
	maskTemplateLiterals,
	splitLines
} from '../../src/audit/development-tooling/commonRules';
import { harnessRuleLimits, type HarnessRuleLimits } from '../../src/rules/explorer-ui/catalog';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { expect } from '../verificationExpect';

/**
 * Each exported operation of the commonRules audit is called the way the audit calls it: line lists
 * come from splitLines, and structural lines from splitLines of the masked text. What it was given
 * and what it returned is asserted and recorded as the cases of its state. The CRLF file of the
 * first state is written into, and read back from, a temporary project folder.
 */

const path = 'src/audit/development-tooling/commonRules.ts';

/** Example lines of a source file. Only their count matters to auditFileLength. */
function linesOf(count: number): string[] {
	return Array.from({ length: count }, (_, index) => `const value${index} = ${index};`);
}

const blank = (count: number) => ' '.repeat(count);

/** Splits contents as the audit does and keeps the call as one case. */
function splitting(name: string, contents: string) {
	return { name, input: contents, output: splitLines(contents) };
}

/** Runs auditFileLength on the lines of a file, keeping the line count as the case input. */
function fileLength(name: string, lines: string[], limits?: HarnessRuleLimits) {
	const input = limits
		? { path, lineCount: lines.length, limits }
		: { path, lineCount: lines.length };
	return { name, input, output: auditFileLength(path, lines, limits) };
}

/** Runs auditClassCount on the structural lines of a file and keeps the call as one case. */
function classCount(name: string, lines: string[], limits?: HarnessRuleLimits) {
	const input = limits ? { path, lines, limits } : { path, lines };
	return { name, input, output: auditClassCount(path, lines, limits) };
}

/** Masks contents as the audit does and keeps the call as one case. */
function masking(name: string, contents: string) {
	return { name, input: contents, output: maskTemplateLiterals(contents) };
}

test('splitLines kept CRLF carriage returns and a final empty line', async () => {
	const fromFolder = await withTempDir('audit-split-lines-', async (root) => {
		await writeFile(join(root, 'legacy.ts'), 'const first = 1;\r\nconst second = 2;\r\n');
		const contents = await readFile(join(root, 'legacy.ts'), 'utf8');
		return splitting('a CRLF file read from a project folder keeps each carriage return', contents);
	});
	const trailing = splitting(
		'a trailing newline gives a final empty line',
		'export const version = 2;\n'
	);
	const classFile = splitting(
		'a class with a method and a trailing newline',
		'export class Parser {\n  parse() {}\n}\n'
	);
	const empty = splitting('an empty file gives one empty line', '');
	expect(fromFolder.output).toEqual(['const first = 1;\r', 'const second = 2;\r', '']);
	expect(trailing.output).toEqual(['export const version = 2;', '']);
	expect(classFile.output).toEqual(['export class Parser {', '  parse() {}', '}', '']);
	expect(empty.output).toEqual(['']);
	recordExampleCases(
		{
			unitId: 'audit.common-rules',
			symbol: 'splitLines',
			state: 'splitlines-kept-crlf-carriage-returns-and-a-final-empty-line',
			evidence: 'examples-cases',
			file: 'splitlines-kept-crlf-carriage-returns-and-a-final-empty-line.json'
		},
		[fromFolder, trailing, classFile, empty]
	);
});

test('auditFileLength flagged only files over the limit', () => {
	const noTrailingNewline = fileLength(
		'220 lines with no trailing newline give no finding',
		linesOf(220)
	);
	const trailingNewline = fileLength(
		'220 lines and a trailing newline give 221 entries and one finding',
		splitLines(`${linesOf(220).join('\n')}\n`)
	);
	const lowered = fileLength('4 lines against a limit of 3 give one finding', linesOf(4), {
		...harnessRuleLimits,
		maxFileLines: 3
	});
	const loweredAtLimit = fileLength('3 lines against a limit of 3 give no finding', linesOf(3), {
		...harnessRuleLimits,
		maxFileLines: 3
	});
	expect(noTrailingNewline.output).toEqual([]);
	expect(trailingNewline.output).toEqual([
		{
			path,
			rule: 'small-file',
			message: 'File has 221 lines. Limit is 220. Split it by responsibility.'
		}
	]);
	expect(lowered.output).toEqual([
		{
			path,
			rule: 'small-file',
			message: 'File has 4 lines. Limit is 3. Split it by responsibility.'
		}
	]);
	expect(loweredAtLimit.output).toEqual([]);
	recordExampleCases(
		{
			unitId: 'audit.common-rules',
			symbol: 'auditFileLength',
			state: 'auditfilelength-flagged-only-files-over-the-limit',
			evidence: 'examples-cases',
			file: 'auditfilelength-flagged-only-files-over-the-limit.json'
		},
		[noTrailingNewline, trailingNewline, lowered, loweredAtLimit]
	);
});

/** A file with two class declarations, as in the unit contract. */
const twoClassFile = ['export class Parser {', '  parse() {}', '}', '', 'class Lexer {', '}'];
/** One class among default, abstract and expression declarations, which are not counted. */
const declarationFile = [
	'export default class Helper {',
	'}',
	'export abstract class Base {',
	'}',
	'const Lexer = class {};',
	'export class Parser {',
	'}'
];
/** A file whose only class sits inside a template literal, so masking blanks it. */
const templateSource = 'export class Parser {}\nconst sample = `\nclass Example {}\n`;';

test('auditClassCount flagged a file with two class lines', () => {
	const twoClasses = classCount(
		'two class lines, as in the contract, give one finding',
		twoClassFile
	);
	const declarations = classCount(
		'default, abstract and expression declarations are not counted, leaving one class',
		declarationFile
	);
	const inTemplate = classCount(
		'a class line inside a template literal is masked before it is counted',
		splitLines(maskTemplateLiterals(templateSource))
	);
	const limitOfTwo = classCount('two class lines at a limit of two give no finding', twoClassFile, {
		...harnessRuleLimits,
		maxClassesPerFile: 2
	});
	expect(twoClasses.output).toEqual([
		{ path, rule: 'max-classes-per-file', message: 'File defines 2 classes. Limit is 1.' }
	]);
	expect(declarations.output).toEqual([]);
	expect(inTemplate.output).toEqual([]);
	expect(limitOfTwo.output).toEqual([]);
	recordExampleCases(
		{
			unitId: 'audit.common-rules',
			symbol: 'auditClassCount',
			state: 'auditclasscount-flagged-a-file-with-two-class-lines',
			evidence: 'examples-cases',
			file: 'auditclasscount-flagged-a-file-with-two-class-lines.json'
		},
		[twoClasses, declarations, inTemplate, limitOfTwo]
	);
});

test('maskTemplateLiterals blanked each span and kept its newlines', () => {
	const interpolated = masking(
		'a template literal with an interpolation is blanked between its backticks',
		'const label = `Hi ${name}`;'
	);
	const multiline = masking(
		'a span over two lines keeps the newline between them',
		'const s = `line one\nline two`;'
	);
	const escaped = masking(
		'an escaped backtick inside a span does not close it',
		'const t = `a \\` b`;'
	);
	const quoted = masking(
		'a backtick in a double-quoted string opens a span that runs to the end',
		'const q = "`"; const x = 1;'
	);
	expect(interpolated.output).toBe('const label = `' + blank(10) + '`;');
	expect(multiline.output).toBe('const s = `' + blank(8) + '\n' + blank(8) + '`;');
	expect(multiline.output.split('\n')).toHaveLength(multiline.input.split('\n').length);
	expect(escaped.output).toBe('const t = `' + blank(6) + '`;');
	expect(quoted.output).toBe('const q = "`' + blank(15));
	recordExampleCases(
		{
			unitId: 'audit.common-rules',
			symbol: 'maskTemplateLiterals',
			state: 'masktemplateliterals-blanked-each-span-and-kept-its-newlines',
			evidence: 'examples-cases',
			file: 'masktemplateliterals-blanked-each-span-and-kept-its-newlines.json'
		},
		[interpolated, multiline, escaped, quoted]
	);
});
