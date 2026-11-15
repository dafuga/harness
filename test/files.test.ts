import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import {
	ensureParents,
	renderFileList,
	writePlannedFiles
} from '../src/core/development-tooling/files';
import { assertColdEntries } from './support/coldEntries';
import { measureWorkload } from './support/measureWorkload';

test('writes planned files and renders statuses', () =>
	measureWorkload('function.files', 'write-planned-file-statuses', async () => {
		const root = await mkdtemp(join(tmpdir(), 'harness-files-'));
		const files = [{ path: 'src/index.ts', contents: 'export const ok = true;\n' }];

		await ensureParents(root, files);
		const writes = await writePlannedFiles(root, files);

		expect(await readFile(join(root, 'src/index.ts'), 'utf8')).toBe(files[0].contents);
		expect(renderFileList(writes)).toBe('  create src/index.ts');
		await rm(root, { recursive: true, force: true });
		assertColdEntries(
			[
				'src/core/development-tooling/files.ts',
				'src/adapters/development-tooling/planned-files/writePlannedFiles.ts'
			].map((entry) => ({
				entry,
				code: `const {mkdtemp,rm,readFile}=await import('node:fs/promises'); const root=await mkdtemp(workspace+'/files-'); try { const files=[{path:'src/value.ts',contents:'first'}]; await m.ensureParents(root, files); const first=await m.writePlannedFiles(root, files); const same=await m.writePlannedFiles(root, files); let refusal; try { await m.writePlannedFiles(root,[{path:'src/value.ts',contents:'next'}]); } catch(error) { refusal=error.message; } const force=await m.writePlannedFiles(root,[{path:'src/value.ts',contents:'next'}],{force:true}); console.log(JSON.stringify({statuses:[first[0].status,same[0].status,force[0].status],refusal,contents:await readFile(root+'/src/value.ts','utf8')})); } finally { await rm(root,{recursive:true,force:true}); }`
			})),
			{
				statuses: ['created', 'skipped', 'overwritten'],
				refusal: 'Refusing to overwrite src/value.ts. Re-run with --force to replace it.',
				contents: 'next'
			}
		);
	}));

test('skips identical files and protects changed files unless forced', async () => {
	const root = await mkdtemp(join(tmpdir(), 'harness-files-'));
	const target = join(root, 'README.md');
	await writeFile(target, 'first\n');

	const skipped = await writePlannedFiles(root, [{ path: 'README.md', contents: 'first\n' }]);
	expect(skipped[0].status).toBe('skipped');

	await expect(
		writePlannedFiles(root, [{ path: 'README.md', contents: 'next\n' }])
	).rejects.toThrow('Refusing to overwrite README.md');

	const overwritten = await writePlannedFiles(root, [{ path: 'README.md', contents: 'next\n' }], {
		force: true
	});
	expect(overwritten[0].status).toBe('overwritten');
	expect(await readFile(target, 'utf8')).toBe('next\n');
	await rm(root, { recursive: true, force: true });
});

test('src/core relocation stubs stay deleted', () => {
	for (const stub of [
		'src/core/fields.ts',
		'src/core/files.ts',
		'src/core/impactTypes.ts',
		'src/core/jevTypes.ts'
	])
		expect(existsSync(join(import.meta.dirname, '..', stub)), stub).toBe(false);
});
