import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { reportFiles } from '../../src/repositories/reports-media/report-repository/reportFiles';
import { safeId, readJson, atomicJson } from '../../src/utils/reports-media/reportFiles';
import { InvalidReportOrAssetIdError } from '../../src/utils/reports-media/reportFiles.types';

const roots: string[] = [];

function tempRoot() {
	const root = mkdtempSync(join(tmpdir(), 'report-files-'));
	roots.push(root);
	return root;
}

afterEach(() => {
	for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

test('Returns an explicit report store root', () => {
	const input = '/srv/project-reports';
	const output = reportFiles(input);
	expect(output).toBe(input);
	recordExampleCases(
		{
			unitId: 'reports.function.report-files',
			symbol: 'reportFiles',
			state: 'returns-an-explicit-report-store-root',
			evidence: 'examples-cases',
			file: 'returns-an-explicit-report-store-root.json'
		},
		[{ name: 'explicit root override', input: { root: input }, output }]
	);
});

test('Accepts valid and rejects invalid identifiers', () => {
	const valid = ['report-2026-11-15', 'asset_01'];
	const rejected = ['', 'bad/id'];
	const output = valid.map((id) => safeId(id));
	expect(output).toEqual(valid);
	expect(() => safeId(rejected[1])).toThrow(InvalidReportOrAssetIdError);
	recordExampleCases(
		{
			unitId: 'reports.function.report-files',
			symbol: 'safeId',
			state: 'accepts-valid-and-rejects-invalid-identifiers',
			evidence: 'examples-cases',
			file: 'accepts-valid-and-rejects-invalid-identifiers.json'
		},
		[
			{ name: 'report identifier', input: valid[0], output: output[0] },
			{ name: 'asset identifier', input: valid[1], output: output[1] },
			{ name: 'empty identifier', input: rejected[0], error: 'Invalid report or asset ID' },
			{ name: 'identifier with slash', input: rejected[1], error: 'Invalid report or asset ID' }
		]
	);
});

test('Reads JSON from a UTF-8 file', async () => {
	const root = tempRoot();
	const path = join(root, 'reports', 'example.json');
	const input = { id: 'report-2026-11-15', status: 'ready' };
	mkdirSync(join(root, 'reports'), { recursive: true });
	writeFileSync(path, JSON.stringify(input), 'utf8');
	const output = await readJson<typeof input>(path);
	expect(output).toEqual(input);
	recordExampleCases(
		{
			unitId: 'reports.function.report-files',
			symbol: 'readJson',
			state: 'reads-json-from-a-utf-8-file',
			evidence: 'examples-cases',
			file: 'reads-json-from-a-utf-8-file.json'
		},
		[{ name: 'report file', input: { path: 'reports/example.json' }, output }]
	);
});

test('Atomically writes formatted JSON', async () => {
	const path = join(tempRoot(), 'nested', 'reports', 'report-2026-11-15.json');
	const input = { id: 'report-2026-11-15', title: 'Weekly report', status: 'ready' };
	const result = await atomicJson(path, input);
	const output = JSON.parse(readFileSync(path, 'utf8')) as typeof input;
	expect(output).toEqual(input);
	expect(result).toBeUndefined();
	recordExampleCases(
		{
			unitId: 'reports.function.report-files',
			symbol: 'atomicJson',
			state: 'atomically-writes-formatted-json',
			evidence: 'examples-cases',
			file: 'atomically-writes-formatted-json.json'
		},
		[
			{
				name: 'nested report destination',
				input: { path: 'nested/reports/report-2026-11-15.json', data: input },
				output
			}
		]
	);
});
