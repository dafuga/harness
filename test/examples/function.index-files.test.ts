import { mkdir, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'vitest';
import { indexFiles } from '../../src/utils/development-tooling/indexFiles';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { expect } from '../verificationExpect';

test('Reads regular history index files in stable path order', async () => {
	await withTempDir('index-files-', async (directory) => {
		const index = join(directory, 'history');
		await mkdir(join(index, 'revisions'), { recursive: true });
		await mkdir(join(index, 'media'));
		await writeFile(join(index, 'index.json'), '{"revision":"abc"}');
		await writeFile(join(index, 'revisions', 'abc.json'), '{"files":[]}');
		await writeFile(join(index, 'media', 'note.txt'), 'kept');
		await symlink(join(index, 'media', 'note.txt'), join(index, 'media', 'alias.txt'));
		const files = await indexFiles(index);
		const output = files.map(({ path, bytes }) => ({ path, text: bytes.toString() }));

		expect(output).toEqual([
			{ path: 'index.json', text: '{"revision":"abc"}' },
			{ path: 'media/note.txt', text: 'kept' },
			{ path: 'revisions/abc.json', text: '{"files":[]}' }
		]);
		const missing = join(directory, 'missing-index');
		await mkdir(missing);
		await expect(indexFiles(missing)).rejects.toThrow(
			`${missing} is not a history index: run harness history build --out ${missing} first.`
		);
		recordExampleCases(
			{
				unitId: 'function.index-files',
				symbol: 'indexFiles',
				state: 'reads-regular-history-index-files-in-stable-path-order',
				evidence: 'examples-cases',
				file: 'reads-regular-history-index-files-in-stable-path-order.json'
			},
			[
				{
					name: 'history index includes regular nested files in path order',
					input: { directory: 'history' },
					output
				},
				{
					name: 'directory without index reports the history build command',
					input: { directory: 'missing-index' },
					error: `is not a history index: run harness history build --out ${missing} first.`
				}
			]
		);
	});
});
