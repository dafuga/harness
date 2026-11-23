import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { indent, fields, errorRows, operationRows } from '../../src/cli/program/contractRows';
import { renderContract } from '../../src/cli/program/renderContract';
import { groupTests, renderUnit } from '../../src/cli/program/renderUnit';
import type { Field } from '../../src/cli/program/renderUnit.types';
import {
	projectFields,
	saveOperations,
	manifest,
	detail
} from './entry.program-render-unit.fixtures';

const thrownError: Field[] = [
	{ name: 'renderUnit.detail', type: 'thrown', description: 'The detail has an unsupported shape.' }
];

test('Indents lines and formats field rows', () => {
	const indented = indent(['Source', 'Contract'], 2);
	const rows = fields(projectFields);
	expect(indented).toEqual(['    Source', '    Contract']);
	expect(rows).toHaveLength(6);
	expect(rows[1]).toBe('  Project identifier.');
	expect(rows[4]).toContain('optional; default "active"');
	expect(fields([])).toEqual(['none']);
	recordExampleCases(
		{
			unitId: 'entry.program-render-unit',
			symbol: 'fields',
			state: 'indents-lines-and-formats-field-rows',
			evidence: 'examples-cases',
			file: 'indents-lines-and-formats-field-rows.json'
		},
		[
			{
				name: 'indent adds two levels',
				input: { lines: ['Source', 'Contract'], depth: 2 },
				output: indented
			},
			{ name: 'fields render project fields', input: projectFields, output: rows },
			{ name: 'fields render none for empty list', input: [], output: ['none'] }
		]
	);
});

test('Formats declared error outcomes', () => {
	const declared = errorRows([], 'declared');
	const unknown = errorRows([], 'unknown');
	const notFound = errorRows([], 'none-found');
	const withErrors = errorRows(thrownError, 'unknown');
	expect(declared).toEqual(['none (declared)']);
	expect(unknown).toEqual(['unknown (indirect calls or dynamic throws)']);
	expect(notFound).toEqual(['none found (static analysis; indirect errors unknown)']);
	expect(withErrors).toContain('Other indirect errors unknown.');
	recordExampleCases(
		{
			unitId: 'entry.program-render-unit',
			symbol: 'errorRows',
			state: 'formats-declared-error-outcomes',
			evidence: 'examples-cases',
			file: 'formats-declared-error-outcomes.json'
		},
		[
			{
				name: 'declared with no errors',
				input: { errors: [], status: 'declared' },
				output: declared
			},
			{ name: 'unknown with no errors', input: { errors: [], status: 'unknown' }, output: unknown },
			{
				name: 'none-found with no errors',
				input: { errors: [], status: 'none-found' },
				output: notFound
			},
			{
				name: 'unknown with a thrown error',
				input: { errors: thrownError, status: 'unknown' },
				output: withErrors
			}
		]
	);
});

test('Renders operation rows with inputs and errors', () => {
	const rows = operationRows(saveOperations);
	expect(rows[0]).toBe('saveProject');
	expect(rows).toContain('    id  string  (required)');
	expect(rows.map((row) => row.trim())).toContain('SaveError');
	recordExampleCases(
		{
			unitId: 'entry.program-render-unit',
			symbol: 'operationRows',
			state: 'renders-operation-rows-with-inputs-and-errors',
			evidence: 'examples-cases',
			file: 'renders-operation-rows-with-inputs-and-errors.json'
		},
		[{ name: 'save project operation', input: saveOperations, output: rows }]
	);
});

test('Groups test files by directory with counts', () => {
	const tests = ['test/example.test.ts', 'tests/render-unit.test.ts', 'test/other.test.ts'];
	const grouped = groupTests(tests);
	const empty = groupTests([]);
	expect(grouped).toEqual(['3 files', '  test/   2', '  tests/  1']);
	expect(empty).toEqual(['none']);
	recordExampleCases(
		{
			unitId: 'entry.program-render-unit',
			symbol: 'groupTests',
			state: 'groups-test-files-by-directory-with-counts',
			evidence: 'examples-cases',
			file: 'groups-test-files-by-directory-with-counts.json'
		},
		[
			{ name: 'two directories across three files', input: tests, output: grouped },
			{ name: 'no test files', input: [], output: empty }
		]
	);
});

test('Renders the declared contract sections', () => {
	const lines = renderContract(manifest);
	expect(lines[0]).toBe('Contract (declared)');
	expect(lines).toContain('    id  string  (required)');
	expect(lines).toContain('  Errors');
	expect(lines.map((line) => line.trim())).toContain('none');
	recordExampleCases(
		{
			unitId: 'entry.program-render-unit',
			symbol: 'renderContract',
			state: 'renders-the-declared-contract-sections',
			evidence: 'examples-cases',
			file: 'renders-the-declared-contract-sections.json'
		},
		[{ name: 'declared entry unit contract', input: manifest, output: lines }]
	);
});

test('Renders the unit detail summary', () => {
	const text = renderUnit(detail);
	expect(text.startsWith('# entry.example')).toBe(true);
	expect(text).toContain('Impacted test files');
	recordExampleCases(
		{
			unitId: 'entry.program-render-unit',
			symbol: 'renderUnit',
			state: 'renders-the-unit-detail-summary',
			evidence: 'examples-cases',
			file: 'renders-the-unit-detail-summary.json'
		},
		[{ name: 'entry unit with one consumer and test', input: detail, output: text }]
	);
});
