import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { BuildIdentityService } from '../../src/services/BuildIdentityService';
import { buildStamp, emptyBuildStamp, sdkPackage } from '../../src/utils/buildStamp';

let root: string;
const service = new BuildIdentityService();
/** A compiled server that cannot read its own files: what it reports is a constant inside it. */
async function worker(name: string, page = 'first'): Promise<string> {
	const directory = join(root, name);
	await mkdir(join(directory, 'assets'), { recursive: true });
	await writeFile(join(directory, '_worker.js'), `export const build = "${emptyBuildStamp()}";\n`);
	await writeFile(join(directory, 'assets/app.js'), `render("${page}");\n`);
	return directory;
}
beforeAll(async () => {
	root = await mkdtemp(join(tmpdir(), 'harness-build-stamp-'));
});
afterAll(() => rm(root, { recursive: true, force: true }));

test('stamping writes the identity of exactly these files into them', async () => {
	const directory = await worker('stamped');
	const before = await service.identify(directory);
	expect(before).toEqual({ buildId: expect.stringMatching(/^[0-9a-f]{64}$/), files: 2 });
	const stamped = await service.stamp(directory);
	// The slot does not count, so the identity is the same before and after it is filled.
	expect(stamped.buildId).toBe(before?.buildId);
	expect(await readFile(join(directory, '_worker.js'), 'utf8')).toBe(
		`export const build = "harness-build:${stamped.buildId}";\n`
	);
	expect(await service.identify(directory)).toEqual({
		buildId: stamped.buildId,
		files: 2,
		stamp: stamped.buildId
	});
	expect((await service.stamp(directory)).buildId).toBe(stamped.buildId);
	expect((await service.declared(root, [{ id: 'worker', directory: 'stamped' }])).failures).toEqual(
		[]
	);
});

test('another build has another stamp, and files changed after stamping are refused', async () => {
	const first = await service.stamp(await worker('one', 'first'));
	const second = await service.stamp(await worker('two', 'second'));
	expect(second.buildId).not.toBe(first.buildId);
	await writeFile(join(root, 'one/assets/app.js'), 'render("changed after stamping");\n');
	const judged = await service.declared(root, [{ id: 'worker', directory: 'one' }]);
	expect(judged.found).toEqual([]);
	expect(judged.failures).toEqual([
		expect.stringMatching(/^build worker carries the stamp of other files/)
	]);
});

test('a build with nowhere to put a stamp is not stamped silently', async () => {
	const directory = join(root, 'plain');
	await mkdir(directory, { recursive: true });
	await writeFile(join(directory, 'index.js'), 'export default 1;\n');
	await expect(service.stamp(directory)).rejects.toThrow(/no stamp slot/);
	expect((await service.identify(directory))?.stamp).toBeUndefined();
});

test('code that was never stamped reports no build, and names the package it is', async () => {
	expect([buildStamp(), buildStamp(emptyBuildStamp()), buildStamp('other')]).toEqual([
		null,
		null,
		null
	]);
	expect(buildStamp(`harness-build:${'a'.repeat(64)}`)).toBe('a'.repeat(64));
	const manifest = JSON.parse(await readFile('package.json', 'utf8')) as Record<string, string>;
	expect(sdkPackage).toEqual({ name: manifest.name, version: manifest.version });
});
