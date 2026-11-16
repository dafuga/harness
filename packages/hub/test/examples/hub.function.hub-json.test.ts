import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import {
	hubJson,
	hubHash,
	hubContractHash,
	hubFail,
	hubFile
} from '../../src/utils/development-tooling/hubJson';
import { HarnessArtifactUnavailableError } from '../../src/utils/development-tooling/hubJson.types';

function failure(action: () => unknown) {
	try {
		action();
	} catch (error) {
		const value = error as Error & { code?: string };
		return {
			isArtifactError: error instanceof HarnessArtifactUnavailableError,
			name: value.name,
			message: value.message,
			code: value.code
		};
	}
	return null;
}

test('Decodes committed JSON and rejects corrupt bytes', () => {
	const bytes = new TextEncoder().encode('{"ok":true,"count":2}');
	const decoded = hubJson(bytes);
	const invalid = failure(() => hubJson(new Uint8Array([0xff])));
	expect(decoded).toEqual({ ok: true, count: 2 });
	expect(invalid).toMatchObject({
		name: 'HarnessArtifactUnavailableError',
		message: 'Invalid committed artifact',
		code: 'artifact-corrupt'
	});
	recordExampleCases(
		{
			unitId: 'hub.function.hub-json',
			symbol: 'hubJson',
			state: 'decodes-committed-json-and-rejects-corrupt-bytes',
			evidence: 'examples-cases',
			file: 'decodes-committed-json-and-rejects-corrupt-bytes.json'
		},
		[
			{ name: 'valid UTF-8 JSON object', input: '{"ok":true,"count":2}', output: decoded },
			{ name: 'invalid UTF-8 byte', input: [255], error: invalid }
		]
	);
});

test('Hashes UTF-8 strings and byte inputs', async () => {
	const textDigest = await hubHash('hello');
	const byteDigest = await hubHash(new TextEncoder().encode('hello'));
	expect(textDigest).toBe('2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824');
	expect(byteDigest).toBe(textDigest);
	recordExampleCases(
		{
			unitId: 'hub.function.hub-json',
			symbol: 'hubHash',
			state: 'hashes-utf-8-strings-and-byte-inputs',
			evidence: 'examples-cases',
			file: 'hashes-utf-8-strings-and-byte-inputs.json'
		},
		[
			{ name: 'UTF-8 string', input: 'hello', output: textDigest },
			{ name: 'UTF-8 bytes', input: [104, 101, 108, 108, 111], output: byteDigest }
		]
	);
});

test('Hashes a canonical contract value', async () => {
	const value = { id: 'hub.function.hub-json', version: 1 };
	const digest = await hubContractHash(value);
	expect(digest).toMatch(/^[a-f0-9]{64}$/);
	recordExampleCases(
		{
			unitId: 'hub.function.hub-json',
			symbol: 'hubContractHash',
			state: 'hashes-a-canonical-contract-value',
			evidence: 'examples-cases',
			file: 'hashes-a-canonical-contract-value.json'
		},
		[{ name: 'contract identity and version', input: value, output: digest }]
	);
});

test('Throws artifact errors with the requested code', () => {
	const defaultError = failure(() => hubFail());
	const pathError = failure(() => hubFail('invalid-path'));
	expect(defaultError).toEqual({
		isArtifactError: true,
		name: 'HarnessArtifactUnavailableError',
		message: 'Harness artifact unavailable',
		code: 'artifact-corrupt'
	});
	expect(pathError).toMatchObject({ code: 'invalid-path' });
	recordExampleCases(
		{
			unitId: 'hub.function.hub-json',
			symbol: 'hubFail',
			state: 'throws-artifact-errors-with-the-requested-code',
			evidence: 'examples-cases',
			file: 'throws-artifact-errors-with-the-requested-code.json'
		},
		[
			{ name: 'omitted code uses default', input: {}, error: defaultError },
			{ name: 'custom code is retained', input: 'invalid-path', error: pathError }
		]
	);
});

test('Accepts safe filenames and rejects invalid paths', () => {
	const valid = ['artifact.json', 'report_2026-11.txt'].map(hubFile);
	const invalid = failure(() => hubFile('../secret'));
	expect(valid).toEqual(['artifact.json', 'report_2026-11.txt']);
	expect(invalid).toMatchObject({
		name: 'HarnessArtifactUnavailableError',
		message: 'Harness artifact unavailable',
		code: 'invalid-path'
	});
	recordExampleCases(
		{
			unitId: 'hub.function.hub-json',
			symbol: 'hubFile',
			state: 'accepts-safe-filenames-and-rejects-invalid-paths',
			evidence: 'examples-cases',
			file: 'accepts-safe-filenames-and-rejects-invalid-paths.json'
		},
		[
			{ name: 'document filename', input: 'artifact.json', output: valid[0] },
			{ name: 'traversal filename', input: '../secret', error: invalid }
		]
	);
});
