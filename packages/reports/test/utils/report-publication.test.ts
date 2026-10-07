import { afterEach, expect, test } from 'vitest';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { reportPublication } from '../../src/utils/reportPublication';
import { publicationFixture } from '../publicationFixture';
const roots: string[] = [];
afterEach(async () => {
	await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});
test('publication stages only authorized originals and exports without changing frozen outcomes', async () => {
	const { root, repository, run } = await publicationFixture();
	roots.push(root);
	const manifest = join(repository.directory(run.id), 'manifest.json');
	const frozen = await readFile(manifest);
	const bundle = await reportPublication(repository, run.id);
	expect(bundle.files.map((file) => file.path)).toEqual([
		'index.html',
		'report.pdf',
		'report.zip',
		`assets/${run.evidence[0].file}`
	]);
	expect(await readFile(manifest)).toEqual(frozen);
	const retry = await reportPublication(repository, run.id);
	expect(retry.digest).toBe(bundle.digest);
	expect((await repository.get(run.id)).status).toBe('failed');
});
test('changed evidence bytes cannot be published under the original content hash', async () => {
	const { root, repository, run } = await publicationFixture();
	roots.push(root);
	await writeFile(join(repository.directory(run.id), 'assets', run.evidence[0].file), 'different');
	await expect(reportPublication(repository, run.id)).rejects.toThrow(/content hash/);
});
