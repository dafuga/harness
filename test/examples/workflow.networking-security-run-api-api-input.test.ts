import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'vitest';
import { apiInput, apiQuery } from '../../src/workflows/networking-security/run-api/apiInput';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { expect } from '../verificationExpect';

const unitId = 'workflow.networking-security-run-api-api-input';

test('Parses inline JSON objects', async () => {
	const input = '{"name":"sample","count":2}';
	const output = await apiInput(input);
	expect(output).toEqual({ name: 'sample', count: 2 });
	recordExampleCases(
		{ unitId, symbol: 'apiInput', state: 'parses-inline-json-objects', evidence: 'examples-cases', file: 'parses-inline-json-objects.json' },
		[{ name: 'inline object', input: { input }, output }]
	);
});

test('Reads JSON objects from files', async () => {
	await withTempDir('api-input-', async (directory) => {
		const path = join(directory, 'request.json');
		await writeFile(path, '{"enabled":true,"tags":["a","b"]}', 'utf8');
		const input = `@${path}`;
		const output = await apiInput(input);
		expect(output).toEqual({ enabled: true, tags: ['a', 'b'] });
		recordExampleCases(
			{ unitId, symbol: 'apiInput', state: 'reads-json-objects-from-files', evidence: 'examples-cases', file: 'reads-json-objects-from-files.json' },
			[{ name: 'file object', input: { input }, output }]
		);
	});
});

test('Splits query fields at the first equals sign', () => {
	const fields = ['page=2', 'filter=status=open', 'q='];
	const output = apiQuery(fields);
	expect(output).toEqual([['page', '2'], ['filter', 'status=open'], ['q', '']]);
	recordExampleCases(
		{ unitId, symbol: 'apiQuery', state: 'splits-query-fields-at-the-first-equals-sign', evidence: 'examples-cases', file: 'splits-query-fields-at-the-first-equals-sign.json' },
		[{ name: 'repeated fields', input: { fields }, output }]
	);
});
