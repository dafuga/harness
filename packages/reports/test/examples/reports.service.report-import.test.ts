import { rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { tempDirectory, makeService } from './reports.service.report-import.cases';

test('Imports command outcomes as checks', async () => {
	const directory = tempDirectory('report-import-command');
	try {
		const file = join(directory, 'command.json');
		writeFileSync(
			file,
			JSON.stringify({
				exitCode: 1,
				title: 'Typecheck',
				command: 'bun run typecheck',
				output: '1 error',
				durationMs: 120
			})
		);
		const { service, records } = makeService();
		const output = await service.ingest('command', 'report-2', file);
		expect(output).toEqual({ checks: 1 });
		expect(records[0]).toEqual({
			reportId: 'report-2',
			record: {
				kind: 'check',
				data: {
					id: expect.any(String),
					title: 'Typecheck',
					status: 'failed',
					command: 'bun run typecheck',
					output: '1 error',
					durationMs: 120,
					group: 'Command'
				}
			}
		});
		recordExampleCases(
			{
				unitId: 'reports.service.report-import',
				symbol: 'ingest',
				state: 'imports-command-outcomes-as-checks',
				evidence: 'examples-cases',
				file: 'imports-command-outcomes-as-checks.json'
			},
			[
				{
					name: 'nonzero exit code becomes a failed check',
					input: {
						format: 'command',
						id: 'report-2',
						exitCode: 1,
						title: 'Typecheck',
						command: 'bun run typecheck',
						output: '1 error',
						durationMs: 120
					},
					output: {
						checks: 1,
						status: 'failed',
						title: 'Typecheck',
						command: 'bun run typecheck',
						durationMs: 120
					}
				}
			]
		);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test('Throws Error when the import format is unsupported', async () => {
	const directory = tempDirectory('report-import-unsupported');
	try {
		const file = join(directory, 'import.json');
		writeFileSync(file, '{}');
		const { service } = makeService();
		await expect(service.ingest('unknown', 'report-3', file)).rejects.toThrow(
			'Unsupported import format'
		);
		recordExampleCases(
			{
				unitId: 'reports.service.report-import',
				symbol: 'ingest',
				state: 'throws-error-when-the-import-format-is-unsupported',
				evidence: 'examples-cases',
				file: 'throws-error-when-the-import-format-is-unsupported.json'
			},
			[
				{
					name: 'unknown format is rejected',
					input: { format: 'unknown', id: 'report-3', json: {} },
					error: { name: 'Error', message: 'Unsupported import format' }
				}
			]
		);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test('Throws SyntaxError when the import file is invalid JSON', async () => {
	const directory = tempDirectory('report-import-invalid-json');
	try {
		const file = join(directory, 'import.json');
		writeFileSync(file, '{invalid');
		const { service } = makeService();
		await expect(service.ingest('manual', 'report-4', file)).rejects.toThrow(SyntaxError);
		recordExampleCases(
			{
				unitId: 'reports.service.report-import',
				symbol: 'ingest',
				state: 'throws-syntaxerror-when-the-import-file-is-invalid-json',
				evidence: 'examples-cases',
				file: 'throws-syntaxerror-when-the-import-file-is-invalid-json.json'
			},
			[
				{
					name: 'malformed JSON is rejected',
					input: { format: 'manual', id: 'report-4', contents: '{invalid' },
					error: { name: 'SyntaxError' }
				}
			]
		);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test('Throws TypeError when command data is null', async () => {
	const directory = tempDirectory('report-import-null-command');
	try {
		const file = join(directory, 'command.json');
		writeFileSync(file, 'null');
		const { service } = makeService();
		await expect(service.ingest('command', 'report-5', file)).rejects.toThrow(TypeError);
		recordExampleCases(
			{
				unitId: 'reports.service.report-import',
				symbol: 'ingest',
				state: 'throws-typeerror-when-command-data-is-null',
				evidence: 'examples-cases',
				file: 'throws-typeerror-when-command-data-is-null.json'
			},
			[
				{
					name: 'null command data cannot provide an exit code',
					input: { format: 'command', id: 'report-5', json: null },
					error: { name: 'TypeError' }
				}
			]
		);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});
