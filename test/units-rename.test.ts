import { readdir, rename, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { expect, test } from 'vitest';
import { unitProject } from './support/unitProject';
import type { Manifest } from './units-shell-kind.test.types';

interface Stored extends Manifest {
	uid?: string;
	status: string;
	lineage?: { predecessors: string[] };
	retired?: { reason: string };
}

test('a renamed unit keeps its uid and contract, leaves a tombstone and survives a source move', async () => {
	const project = await unitProject('app');
	await project.harness(['generate', 'component', 'AppFrame']);
	await project.harness(['units', 'index', '--write']);
	const listed = async () => (await readdir(join(project.root, 'specification/units'))).sort();
	const oldFile = (await listed()).find((name) => name.includes('app-frame'))!;
	const oldId = oldFile.replace(/\.json$/, '');
	const before = await project.json<Stored>(`specification/units/${oldFile}`);
	expect(before.uid).toMatch(/^u_[a-z2-7]{10}$/);

	const newId = 'component.window-frame';
	await project.harness(['units', 'rename', oldId, newId]);
	const renamed = await project.json<Stored>(`specification/units/${newId}.json`);
	expect(renamed.id).toBe(newId);
	expect(renamed.uid).toBe(before.uid);
	expect(renamed.owns.source).toEqual(before.owns.source);
	expect(renamed.lineage?.predecessors).toEqual([oldId]);
	const tomb = await project.json<Stored>(`specification/units/${oldId}.json`);
	expect([tomb.status, tomb.uid]).toEqual(['retired', undefined]);
	expect(tomb.retired?.reason).toBe(`Renamed to ${newId}.`);
	await project.harness(['units', 'index', '--write']);
	expect((await project.json<Stored>(`specification/units/${newId}.json`)).uid).toBe(before.uid);

	const [from] = renamed.owns.source;
	const to = join('src/components/moved', 'WindowFrame.svelte');
	await mkdir(dirname(join(project.root, to)), { recursive: true });
	await rename(join(project.root, from), join(project.root, to));
	await project.harness(['units', 'index', '--write']);
	const moved = await project.json<Stored>(`specification/units/${newId}.json`);
	expect(moved.owns.source).toContain(to);
	expect(await listed()).toEqual(expect.arrayContaining([oldFile, `${newId}.json`]));
});

test('renaming refuses unknown units, invalid ids and ids that were ever used', async () => {
	const project = await unitProject('app');
	await project.harness(['generate', 'component', 'AppFrame']);
	await project.harness(['units', 'index', '--write']);
	const id = (await readdir(join(project.root, 'specification/units')))
		.find((name) => name.includes('app-frame'))!
		.replace(/\.json$/, '');
	for (const args of [
		['units', 'rename', 'component.nothing', 'component.other'],
		['units', 'rename', id, 'Bad Id'],
		['units', 'rename', id, id]
	])
		await project.harness(args, false);
});
