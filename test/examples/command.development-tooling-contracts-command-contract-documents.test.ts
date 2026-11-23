import * as fs from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import {
	contractFiles,
	readContractJson
} from '../../src/commands/development-tooling/contracts-command/contractDocuments';

const unitId = 'command.development-tooling-contracts-command-contract-documents';

async function writeFixture(root: string, relative: string, content: string): Promise<void> {
	const path = join(root, relative);
	await fs.mkdir(dirname(path), { recursive: true });
	await fs.writeFile(path, content);
}

function relativeTo(root: string, paths: string[]): string[] {
	return paths.map((path) => path.slice(root.length + 1));
}

test('Lists nested contract JSON files in sorted order', async () => {
	await withTempDir('contract-files-', async (root) => {
		await writeFixture(root, 'units/b.json', '{}');
		await writeFixture(root, 'units/a/nested.json', '[]');
		await writeFixture(root, 'units/notes.txt', 'skipped');
		await fs.symlink(join(root, 'units/b.json'), join(root, 'units/link.json'));
		await fs.symlink(join(root, 'units/a'), join(root, 'units/linked-dir'));

		const files = relativeTo(root, await contractFiles(join(root, 'units')));
		const missing = await contractFiles(join(root, 'missing'));

		expect(files).toEqual(['units/a/nested.json', 'units/b.json']);
		expect(missing).toEqual([]);
		recordExampleCases(
			{
				unitId,
				symbol: 'contractFiles',
				state: 'lists-nested-contract-json-files-in-sorted-order',
				evidence: 'examples-cases',
				file: 'lists-nested-contract-json-files-in-sorted-order.json'
			},
			[
				{
					name: 'nested tree with a symlink file, a symlinked directory and a non-JSON file',
					input: { directory: 'units' },
					output: { files }
				},
				{
					name: 'directory that does not exist',
					input: { directory: 'missing' },
					output: { files: missing }
				}
			]
		);
	});
});

test('Parses contract JSON and labels an unreadable document', async () => {
	await withTempDir('contract-json-', async (root) => {
		await writeFixture(root, 'units/ok.json', '{"id":"command.example","items":[1,null]}');
		await writeFixture(root, 'units/bad.json', '{"id":');
		const label = 'specification/units/bad.json';
		const parsed = await readContractJson(
			join(root, 'units/ok.json'),
			'specification/units/ok.json'
		);
		const error = await readContractJson(join(root, 'units/bad.json'), label).catch(
			(caught: unknown) => (caught as Error).message
		);

		expect(parsed).toEqual({ id: 'command.example', items: [1, null] });
		expect(error).toBe(`Cannot read JSON contract ${label}.`);
		recordExampleCases(
			{
				unitId,
				symbol: 'readContractJson',
				state: 'parses-contract-json-and-labels-an-unreadable-document',
				evidence: 'examples-cases',
				file: 'parses-contract-json-and-labels-an-unreadable-document.json'
			},
			[
				{
					name: 'valid object with an array and null',
					input: { path: 'units/ok.json', label: 'specification/units/ok.json' },
					output: parsed
				},
				{
					name: 'truncated JSON document',
					input: { path: 'units/bad.json', label },
					error
				}
			]
		);
	});
});
