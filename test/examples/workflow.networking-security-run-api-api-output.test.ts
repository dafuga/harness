import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'vitest';
import { apiOutput } from '../../src/workflows/networking-security/run-api/apiOutput';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { expect } from '../verificationExpect';

const unitId = 'workflow.networking-security-run-api-api-output';

test('Writes the selected JSON field to a new file', async () => {
	await withTempDir('api-output-json-', async (directory) => {
		const output = join(directory, 'response.json');
		const result = {
			status: 'ok',
			data: { count: 3, items: [{ name: 'edge-gateway', state: 'active' }] }
		};
		await apiOutput(result, { output, select: 'data.count' });
		const printed = await readFile(output, 'utf8');
		expect(printed).toBe('3\n');
		recordExampleCases(
			{
				unitId,
				symbol: 'apiOutput',
				state: 'writes-the-selected-json-field-to-a-new-file',
				evidence: 'examples-cases',
				file: 'writes-the-selected-json-field-to-a-new-file.json'
			},
			[
				{
					name: 'selects data.count from an API result',
					input: { result, options: { output: 'response.json', select: 'data.count' } },
					output: printed
				}
			]
		);
	});
});

test('Writes binary response bytes without replacing an existing file', async () => {
	await withTempDir('api-output-binary-', async (directory) => {
		const output = join(directory, 'response.bin');
		const bytes = new Uint8Array([0, 17, 255]);
		await apiOutput({ data: null, bytes, mediaType: 'application/octet-stream' }, { output });
		const written = [...(await readFile(output))];
		expect(written).toEqual([0, 17, 255]);
		let error: unknown;
		try {
			await apiOutput({ data: null, bytes, mediaType: 'application/octet-stream' }, { output });
		} catch (caught) {
			error = caught;
		}
		expect((error as { code?: string }).code).toBe('EEXIST');
		recordExampleCases(
			{
				unitId,
				symbol: 'apiOutput',
				state: 'writes-binary-response-bytes-without-replacing-an-existing-f',
				evidence: 'examples-cases',
				file: 'writes-binary-response-bytes-without-replacing-an-existing-f.json'
			},
			[
				{
					name: 'writes binary bytes and rejects a second exclusive create',
					input: {
						result: { bytes: [0, 17, 255], mediaType: 'application/octet-stream' },
						options: { output: 'response.bin' }
					},
					output: {
						bytes: written,
						repeatedWriteError: { code: (error as { code?: string }).code }
					}
				}
			]
		);
	});
});

test('Rejects a binary response without an output destination', async () => {
	const result = {
		data: null,
		bytes: new Uint8Array([1, 2, 3]),
		mediaType: 'application/octet-stream'
	};
	let error: unknown;
	try {
		await apiOutput(result, {});
	} catch (caught) {
		error = caught;
	}
	expect(error).toBeInstanceOf(Error);
	expect((error as Error).message).toContain('supply --output');
	recordExampleCases(
		{
			unitId,
			symbol: 'apiOutput',
			state: 'rejects-a-binary-response-without-an-output-destination',
			evidence: 'examples-cases',
			file: 'rejects-a-binary-response-without-an-output-destination.json'
		},
		[
			{
				name: 'requires an output destination for binary data',
				input: {
					result: { bytes: [1, 2, 3], mediaType: 'application/octet-stream' },
					options: {}
				},
				error: { name: (error as Error).name, message: (error as Error).message }
			}
		]
	);
});
