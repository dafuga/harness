import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { buildIdentity, builtFileHash } from '../../src/utils/accounts-access/buildIdentity';
import type { BuiltFile } from '../../src/utils/accounts-access/buildIdentity.types';

test('Build identity sorts file records by path', () => {
	const files = [
		{
			path: 'dist/index.html',
			sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
		},
		{
			path: 'dist/assets/app.js',
			sha256: 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
		}
	] satisfies BuiltFile[];
	const identity = buildIdentity(files);
	const reversedIdentity = buildIdentity([...files].reverse());

	expect(identity).toMatch(/^[0-9a-f]{64}$/);
	expect(reversedIdentity).toBe(identity);
	recordExampleCases(
		{
			unitId: 'function.build-identity',
			symbol: 'buildIdentity',
			state: 'build-identity-sorts-file-records-by-path',
			evidence: 'examples-cases',
			file: 'build-identity-sorts-file-records-by-path.json'
		},
		[
			{ name: 'two emitted files in path order', input: files, output: identity },
			{ name: 'the same files supplied in reverse order', input: [...files].reverse(), output: reversedIdentity }
		]
	);
});

test('Built file hash ignores embedded build stamp values', () => {
	const emptySlot = `asset harness-build:${'0'.repeat(64)}`;
	const filledSlot = `asset harness-build:${'a'.repeat(64)}`;
	const emptyHash = builtFileHash(Buffer.from(emptySlot));
	const filledHash = builtFileHash(Buffer.from(filledSlot));
	const plainHash = builtFileHash(Buffer.from('plain asset'));

	expect(filledHash.sha256).toBe(emptyHash.sha256);
	expect(filledHash.stamps).toEqual(['a'.repeat(64)]);
	expect(plainHash).toMatchObject({ stamps: [], slots: 0 });
	recordExampleCases(
		{
			unitId: 'function.build-identity',
			symbol: 'builtFileHash',
			state: 'built-file-hash-ignores-embedded-build-stamp-values',
			evidence: 'examples-cases',
			file: 'built-file-hash-ignores-embedded-build-stamp-values.json'
		},
		[
			{ name: 'empty build stamp slot', input: emptySlot, output: emptyHash },
			{ name: 'filled build stamp slot', input: filledSlot, output: filledHash },
			{ name: 'bytes without a build stamp marker', input: 'plain asset', output: plainHash }
		]
	);
});
