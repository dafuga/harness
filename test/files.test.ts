import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { ensureParents, renderFileList, writePlannedFiles } from '../src/core/files';

test('writes planned files and renders statuses', async () => {
	const root = await mkdtemp(join(tmpdir(), 'frame-files-'));
	const files = [{ path: 'src/index.ts', contents: 'export const ok = true;\n' }];

	await ensureParents(root, files);
	const writes = await writePlannedFiles(root, files);

	expect(await readFile(join(root, 'src/index.ts'), 'utf8')).toBe(files[0].contents);
	expect(renderFileList(writes)).toBe('  create src/index.ts');
	await rm(root, { recursive: true, force: true });
});

test('skips identical files and protects changed files unless forced', async () => {
	const root = await mkdtemp(join(tmpdir(), 'frame-files-'));
	const target = join(root, 'README.md');
	await writeFile(target, 'first\n');

	const skipped = await writePlannedFiles(root, [{ path: 'README.md', contents: 'first\n' }]);
	expect(skipped[0].status).toBe('skipped');

	await expect(writePlannedFiles(root, [{ path: 'README.md', contents: 'next\n' }])).rejects.toThrow(
		'Refusing to overwrite README.md'
	);

	const overwritten = await writePlannedFiles(
		root,
		[{ path: 'README.md', contents: 'next\n' }],
		{ force: true }
	);
	expect(overwritten[0].status).toBe('overwritten');
	expect(await readFile(target, 'utf8')).toBe('next\n');
	await rm(root, { recursive: true, force: true });
});
