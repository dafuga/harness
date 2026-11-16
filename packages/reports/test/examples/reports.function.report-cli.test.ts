import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { reportCli, inputData, required } from '../../src/services/reports-media/report-command-service/reportCli';

test('Parses report operations flags and positionals', () => {
	const create = reportCli(['create', '--project', 'reports', '--dry-run']);
	const show = reportCli(['show', '--format', 'json', 'report.json']);
	expect(create).toEqual({
		operation: 'create',
		flags: { project: 'reports', 'dry-run': true },
		positionals: []
	});
	expect(show).toEqual({
		operation: 'show',
		flags: { format: 'json' },
		positionals: ['report.json']
	});
	recordExampleCases(
		{
			unitId: 'reports.function.report-cli',
			symbol: 'reportCli',
			state: 'parses-report-operations-flags-and-positionals',
			evidence: 'examples-cases',
			file: 'parses-report-operations-flags-and-positionals.json'
		},
		[
			{ name: 'create dry run', input: ['create', '--project', 'reports', '--dry-run'], output: create },
			{ name: 'show report file', input: ['show', '--format', 'json', 'report.json'], output: show }
		]
	);
});

test('Reads inline and file JSON input', async () => {
	const directory = mkdtempSync(join(tmpdir(), 'report-cli-'));
	try {
		const path = join(directory, 'input.json');
		writeFileSync(path, JSON.stringify({ title: 'Release report' }));
		const inline = await inputData({ data: '{"findings":[],"summary":"No findings"}' });
		const fromFile = await inputData({
			file: path,
			data: '{"title":"Ignored when file is truthy"}'
		});
		expect(inline).toEqual({ findings: [], summary: 'No findings' });
		expect(fromFile).toEqual({ title: 'Release report' });
		recordExampleCases(
			{
				unitId: 'reports.function.report-cli',
				symbol: 'inputData',
				state: 'reads-inline-and-file-json-input',
				evidence: 'examples-cases',
				file: 'reads-inline-and-file-json-input.json'
			},
			[
				{ name: 'inline JSON', input: { data: '{"findings":[],"summary":"No findings"}' }, output: inline },
				{ name: 'file takes precedence over inline data', input: { file: 'input.json', data: '{"title":"ignored"}' }, output: fromFile }
			]
		);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test('Requires a nonblank value and preserves whitespace', () => {
	const plain = required({ project: 'reports' }, 'project');
	const spaced = required({ title: '  release  ' }, 'title');
	expect(plain).toBe('reports');
	expect(spaced).toBe('  release  ');
	recordExampleCases(
		{
			unitId: 'reports.function.report-cli',
			symbol: 'required',
			state: 'requires-a-nonblank-value-and-preserves-whitespace',
			evidence: 'examples-cases',
			file: 'requires-a-nonblank-value-and-preserves-whitespace.json'
		},
		[
			{ name: 'project value', input: { flags: { project: 'reports' }, name: 'project' }, output: plain },
			{ name: 'surrounding whitespace is retained', input: { flags: { title: '  release  ' }, name: 'title' }, output: spaced }
		]
	);
});
