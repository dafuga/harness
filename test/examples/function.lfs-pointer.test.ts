import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { lfsAttributes } from '../../src/repositories/verification-evidence/evidence-branch-repository/lfsPointer';
import { parseLfsPointer } from '../../src/services/verification-evidence/history-status-service/attached-record-service/lfsPointer';
import { lfsPointer, lfsStored } from '../../src/utils/verification-evidence/lfsPointer';
import type { LfsObject } from '../../src/utils/verification-evidence/lfsPointer.types';

const objects: LfsObject[] = [
	{ sha256: 'b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9', bytes: 11 },
	{ sha256: 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad', bytes: 3 }
];

test('LFS pointer text round trips and rejects non-pointer content', () => {
	const pointers = objects.map(lfsPointer);
	const parsed = pointers.map(parseLfsPointer);
	const invalid = parseLfsPointer(`${pointers[0]}extra`);
	expect(parsed).toEqual(objects);
	expect(invalid).toBeUndefined();
	recordExampleCases(
		{
			unitId: 'function.lfs-pointer',
			symbol: 'parseLfsPointer',
			state: 'lfs-pointer-text-round-trips-and-rejects-non-pointer-content',
			evidence: 'examples-cases',
			file: 'lfs-pointer-text-round-trips-and-rejects-non-pointer-content.json'
		},
		[
			...pointers.map((pointer, index) => ({
				name: `valid pointer ${index + 1}`,
				input: pointer,
				output: parsed[index]
			})),
			{ name: 'pointer with an extra line', input: `${pointers[0]}extra`, output: invalid }
		]
	);
});

test('LFS storage selection uses the final extension without regard to case', () => {
	const paths = [
		'evidence/checkout-flow/step-2.PNG',
		'evidence/checkout-flow/step-3.webm',
		'evidence/checkout-flow/archive.png.json',
		'evidence/checkout-flow/record'
	];
	const selected = paths.map((path) => lfsStored(path));
	expect(selected).toEqual([true, true, false, false]);
	recordExampleCases(
		{
			unitId: 'function.lfs-pointer',
			symbol: 'lfsStored',
			state: 'lfs-storage-selection-uses-the-final-extension-without-regar',
			evidence: 'examples-cases',
			file: 'lfs-storage-selection-uses-the-final-extension-without-regar.json'
		},
		paths.map((input, index) => ({ name: input, input, output: selected[index] }))
	);
});

test('LFS attributes lists lowercase and uppercase media extensions', () => {
	const attributes = lfsAttributes();
	const lines = attributes.trimEnd().split('\n');
	expect(lines).toHaveLength(22);
	expect(lines.slice(0, 4)).toEqual([
		'*.png filter=lfs diff=lfs merge=lfs -text',
		'*.PNG filter=lfs diff=lfs merge=lfs -text',
		'*.jpg filter=lfs diff=lfs merge=lfs -text',
		'*.JPG filter=lfs diff=lfs merge=lfs -text'
	]);
	recordExampleCases(
		{
			unitId: 'function.lfs-pointer',
			symbol: 'lfsAttributes',
			state: 'lfs-attributes-lists-lowercase-and-uppercase-media-extension',
			evidence: 'examples-cases',
			file: 'lfs-attributes-lists-lowercase-and-uppercase-media-extension.json'
		},
		[
			{
				name: 'media extension attribute rules',
				input: null,
				output: { lines: lines.length, first: lines[0], last: lines.at(-1) }
			}
		]
	);
});
