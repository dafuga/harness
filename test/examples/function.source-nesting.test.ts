import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { statementEnd } from '../../src/utils/development-tooling/block-spans/statementEnd';
import {
	sourceNesting,
	matchingBrace,
	bodyEnd
} from '../../src/utils/development-tooling/sourceNesting';

const unitId = 'function.source-nesting';
const evidence = 'examples-cases';
const sample = 'export function add(a, b) {\n\treturn a + b;\n}\n';
const headerOnly = 'declare function parse(text: string): Result;\n';
const returnTyped = 'function load(): { ok: boolean } {\n\treturn { ok: true };\n}\n';
const constants = 'const total = items.length;\nreturn total;\n';
const newlineStatements = 'const a = 1\nconst b = 2\n';

test('Nesting counts curly braces and groups in masked source', () => {
	const nesting = sourceNesting(sample);
	const unmatched = sourceNesting(')]x');
	const summary = {
		length: nesting.brace.length,
		braceBeforeOpen: nesting.brace[26],
		braceInsideBody: nesting.brace[27],
		braceAfterClose: nesting.brace[44],
		groupInsideParens: nesting.group[20],
		groupAfterParens: nesting.group[25],
		unmatchedGroup: unmatched.group[3]
	};
	expect(summary).toEqual({
		length: 46,
		braceBeforeOpen: 0,
		braceInsideBody: 1,
		braceAfterClose: 0,
		groupInsideParens: 1,
		groupAfterParens: 0,
		unmatchedGroup: -2
	});
	recordExampleCases(
		{
			unitId,
			symbol: 'sourceNesting',
			state: 'nesting-counts-curly-braces-and-groups-in-masked-source',
			evidence,
			file: 'nesting-counts-curly-braces-and-groups-in-masked-source.json'
		},
		[
			{ name: 'function body source yields balanced depths', input: sample, output: summary },
			{
				name: 'unmatched closing characters make the group depth negative',
				input: ')]x',
				output: { unmatchedGroup: unmatched.group[3] }
			}
		]
	);
});

test('Matching brace finds the close of an opened body', () => {
	const closeOfBody = matchingBrace(sourceNesting(sample), 26);
	const fallback = matchingBrace(sourceNesting('{ a'), 0);
	expect(closeOfBody).toBe(43);
	expect(fallback).toBe(2);
	recordExampleCases(
		{
			unitId,
			symbol: 'matchingBrace',
			state: 'matching-brace-finds-the-close-of-an-opened-body',
			evidence,
			file: 'matching-brace-finds-the-close-of-an-opened-body.json'
		},
		[
			{
				name: 'body opened after the signature closes at its brace',
				input: { source: sample, open: 26 },
				output: closeOfBody
			},
			{
				name: 'unclosed brace falls back to the last source offset',
				input: { source: '{ a', open: 0 },
				output: fallback
			}
		]
	);
});

test('Statement end stops at a semicolon or statement newline', () => {
	const semicolon = statementEnd(constants, sourceNesting(constants), 0);
	const newline = statementEnd(newlineStatements, sourceNesting(newlineStatements), 0);
	const insideBody = statementEnd(sample, sourceNesting(sample), 28);
	const unterminated = statementEnd('x = 1', sourceNesting('x = 1'), 0);
	expect([semicolon, newline, insideBody, unterminated]).toEqual([26, 10, 41, 4]);
	recordExampleCases(
		{
			unitId,
			symbol: 'statementEnd',
			state: 'statement-end-stops-at-a-semicolon-or-statement-newline',
			evidence,
			file: 'statement-end-stops-at-a-semicolon-or-statement-newline.json'
		},
		[
			{
				name: 'semicolon ends the first statement',
				input: { masked: constants, start: 0 },
				output: semicolon
			},
			{
				name: 'newline before a const statement ends the first one',
				input: { masked: newlineStatements, start: 0 },
				output: newline
			},
			{
				name: 'semicolon at the same body depth ends a statement inside a body',
				input: { masked: sample, start: 28 },
				output: insideBody
			},
			{
				name: 'unterminated statement ends at the last character',
				input: { masked: 'x = 1', start: 0 },
				output: unterminated
			}
		]
	);
});

test('Body end skips return types and stops at signatures', () => {
	const ends = [sample, returnTyped, headerOnly].map((masked) =>
		bodyEnd(masked, sourceNesting(masked), 0)
	);
	expect(ends).toEqual([43, 57, -1]);
	recordExampleCases(
		{
			unitId,
			symbol: 'bodyEnd',
			state: 'body-end-skips-return-types-and-stops-at-signatures',
			evidence,
			file: 'body-end-skips-return-types-and-stops-at-signatures.json'
		},
		[
			{
				name: 'function body closes at its closing brace',
				input: { masked: sample, from: 0 },
				output: ends[0]
			},
			{
				name: 'object return type is skipped before the real body',
				input: { masked: returnTyped, from: 0 },
				output: ends[1]
			},
			{
				name: 'bodiless declaration stops at its semicolon',
				input: { masked: headerOnly, from: 0 },
				output: ends[2]
			}
		]
	);
});
