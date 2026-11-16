import { mkdir, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'vitest';
import { scanCacheTree } from '../../src/cli/program/history-prune/scanCacheTree';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';

test('Inventories nested files and protects symlinks', async () => {
	await withTempDir('scan-cache-tree-', async (directory) => {
		const cache = join(directory, 'cache');
		await mkdir(join(cache, 'runs', 'run-001'), { recursive: true });
		await writeFile(join(cache, 'manifest.json'), '{}');
		await writeFile(join(cache, 'runs', 'run-001', 'record.json'), 'data');
		await symlink(join(cache, 'manifest.json'), join(cache, 'latest'));

		const output = await scanCacheTree(cache);
		expect(output).toEqual({
			bytes: 6,
			files: ['manifest.json', join('runs', 'run-001', 'record.json')],
			reasons: ['latest: symlink is not traversed']
		});
		recordExampleCases(
			{
				unitId: 'entry.program-history-prune-scan-cache-tree',
				symbol: 'scanCacheTree',
				state: 'inventories-nested-files-and-protects-symlinks',
				evidence: 'examples-cases',
				file: 'inventories-nested-files-and-protects-symlinks.json'
			},
			[
				{
					name: 'counts regular files and skips a symlink',
					input: cache,
					output: {
						bytes: output.bytes,
						files: output.files,
						reasons: output.reasons
					}
				}
			]
		);
	});
});
