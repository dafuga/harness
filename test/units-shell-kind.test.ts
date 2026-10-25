import type { Manifest } from './units-shell-kind.test.types';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { unitProject } from './support/unitProject';

test('a declared shell kind survives reindexing under the same id, and new components stay components', async () => {
	const project = await unitProject('app');
	await project.harness(['generate', 'component', 'AppFrame']);
	expect(await project.read('src/routes/__harness/components/app-frame/+page.svelte')).toContain(
		'@harness-tier page'
	);
	await project.harness(['units', 'index', '--write']);
	const listed = async () => (await readdir(join(project.root, 'specification/units'))).sort();
	const before = await listed();
	expect(before.filter((path) => path.includes('harness-components'))).toEqual([]);
	const file = before.find((name) => name.includes('app-frame'));
	expect(file).toBeDefined();
	const path = `specification/units/${file}`;
	const manifest = await project.json<Manifest>(path);
	expect(manifest.kind).toBe('component');
	await project.write(path, JSON.stringify({ ...manifest, kind: 'shell' }, null, '\t') + '\n');
	await project.harness(['units', 'index', '--write']);
	const after = await project.json<Manifest>(path);
	expect([after.id, after.kind, after.owns.source]).toEqual([
		manifest.id,
		'shell',
		manifest.owns.source
	]);
	expect(await listed()).toEqual(before);
	await project.harness(['units', 'check']);
	await project.harness(['generate', 'component', 'StatusChip']);
	await project.harness(['units', 'index', '--write']);
	const added = (await listed()).filter((name) => !before.includes(name));
	expect(added).toHaveLength(1);
	expect((await project.json<Manifest>(`specification/units/${added[0]}`)).kind).toBe('component');
	expect((await project.json<Manifest>(path)).kind).toBe('shell');
}, 120_000);
