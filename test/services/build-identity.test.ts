import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { BuildIdentityService } from '../../src/services/BuildIdentityService';

let root: string;
const service = new BuildIdentityService();
async function build(name: string, script: string): Promise<string> {
	const directory = join(root, name);
	await mkdir(join(directory, 'assets'), { recursive: true });
	await writeFile(join(directory, 'index.html'), '<title>Titles</title>');
	await writeFile(join(directory, 'assets/app.js'), script);
	return directory;
}
beforeAll(async () => {
	root = await mkdtemp(join(tmpdir(), 'harness-build-identity-'));
});
afterAll(() => rm(root, { recursive: true, force: true }));

test('two builds of the same files share an identity wherever they are', async () => {
	const first = await service.identify(await build('first', 'compiled'));
	const second = await service.identify(await build('nested/second', 'compiled'));
	expect(first).toEqual({ buildId: expect.stringMatching(/^[0-9a-f]{64}$/), files: 2 });
	expect(second).toEqual(first);
});

test('a changed, added or renamed file gives another identity', async () => {
	const original = await service.identify(await build('original', 'compiled'));
	const changed = await service.identify(await build('changed', 'compiled differently'));
	expect(changed?.buildId).not.toBe(original?.buildId);
	const grown = await build('grown', 'compiled');
	await writeFile(join(grown, 'assets/extra.js'), '');
	expect(await service.identify(grown)).toEqual({
		buildId: expect.not.stringMatching(new RegExp(original?.buildId ?? '')),
		files: 3
	});
});

test('a directory with nothing built in it has no identity', async () => {
	expect(await service.identify(join(root, 'absent'))).toBeUndefined();
	const empty = join(root, 'empty');
	await mkdir(join(empty, 'assets'), { recursive: true });
	expect(await service.identify(empty)).toBeUndefined();
	// A link is not a compiled file; only real files are counted.
	await symlink(join(root, 'original/index.html'), join(empty, 'index.html'));
	expect(await service.identify(empty)).toBeUndefined();
});
