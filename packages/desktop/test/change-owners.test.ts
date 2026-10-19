import { expect } from '../../../test/verificationExpect';
import { test } from 'vitest';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createPlanning } from '../../planning/src/index/index';
import { approve, fixture, git, settled } from './run-fixture';

/**
 * The notice of a completed change names, as references, the units whose registered source owns
 * its changed files; a file no unit owns is counted and its path is not repeated in the notice.
 */
const template = resolve(
	import.meta.dirname,
	'../../../specification/units/desktop.function.time-label.json'
);
async function registered(root: string) {
	const manifest = JSON.parse(await readFile(template, 'utf8'));
	const owned = {
		...manifest,
		id: 'app.function.owned',
		title: 'owned',
		owns: { source: ['src/owned.ts'], symbols: [] },
		dependencies: [],
		runtime: {
			kind: 'module',
			entry: 'src/owned.ts',
			targets: [{ kind: 'module', entry: 'src/owned.ts' }]
		},
		scenarios: []
	};
	await mkdir(join(root, 'specification/units'), { recursive: true });
	await writeFile(join(root, 'specification/units/app.function.owned.json'), JSON.stringify(owned));
	git(root, 'add', '.');
	git(root, 'commit', '-m', 'register the owned unit');
}

test('a completed change names the unit owning a changed file and counts the file no unit owns', async () => {
	const f = await fixture(async (turn) => {
		await writeFile(join(turn.cwd, 'src/owned.ts'), 'agent revision');
		await writeFile(join(turn.cwd, 'src/new.ts'), 'new source');
	});
	await registered(f.root);
	await settled(f, await approve(f));
	const plan = await (await createPlanning(f.root)).readPlan({ unitId: f.request.entityId });
	const notice = plan.threads[0].messages.filter((message) => message.change).at(-1)!;
	expect(notice.change).toMatchObject({
		status: 'completed',
		changedPaths: ['src/new.ts', 'src/owned.ts']
	});
	expect(notice.body).toContain(
		'Units changed: [[unit:app.function.owned]]; 1 file outside any unit.'
	);
	expect(notice.body).not.toContain('src/new.ts');
}, 20000);
