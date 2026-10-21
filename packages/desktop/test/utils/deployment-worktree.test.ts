import { expect, test } from 'vitest';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { deploymentFixture } from '../deployment-fixture';
import { deploymentWorktree } from '../../src/utils/deploymentWorktree';

test('isolated builds preserve dirty source and remove only their own checkout on failure', async () => {
	const f = await deploymentFixture();
	await writeFile(join(f.root, 'owned.txt'), 'committed');
	f.git('add', '.');
	f.git('commit', '-m', 'feat: original source');
	const source = f.git('rev-parse', 'HEAD');
	await writeFile(join(f.root, 'owned.txt'), 'unsaved user changes');
	await expect(
		deploymentWorktree(f.root, source, async (directory) => {
			expect(await readFile(join(directory, 'owned.txt'), 'utf8')).toBe('committed');
			expect(
				execFileSync('git', ['rev-parse', 'HEAD'], { cwd: directory, encoding: 'utf8' }).trim()
			).toBe(source);
			await writeFile(join(directory, 'generated.txt'), 'build output');
			throw new Error('build failed');
		})
	).rejects.toThrow('build failed');
	expect(await readFile(join(f.root, 'owned.txt'), 'utf8')).toBe('unsaved user changes');
	expect(f.git('branch', '--show-current')).toBe('dev');
	expect(f.git('worktree', 'list', '--porcelain').match(/worktree /g)).toHaveLength(1);
});
