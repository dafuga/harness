import { expect } from '../../../test/verificationExpect';
import { PNG } from 'pngjs';
import { test } from 'vitest';
import { writeFile, rm, readFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { author, contract, git, fixture } from './planFixture';
test('Git index locks refuse mutations without advancing HEAD or leaving planning files', async () => {
	const { root, api } = await fixture();
	const before = git(root, 'rev-parse', 'HEAD');
	await writeFile(join(root, '.git/index.lock'), 'another operation');
	await expect(
		api.createPlan({
			category: 'function',
			slug: 'safe',
			title: 'Safe',
			goal: 'Safe',
			author,
			contract
		})
	).rejects.toThrow('index is locked');
	expect(git(root, 'rev-parse', 'HEAD')).toBe(before);
	expect(await api.listPlans()).toHaveLength(0);
	await rm(join(root, '.git/index.lock'));
	expect(
		(
			await api.createPlan({
				category: 'function',
				slug: 'safe',
				title: 'Safe',
				goal: 'Safe',
				author,
				contract
			})
		).value.unitId
	).toBe('function.safe');
});

test('PNG designs require usable Git LFS filters without mutating repository state on refusal', async () => {
	const { root, api } = await fixture();
	await api.createPlan({
		category: 'component',
		slug: 'image',
		title: 'Image',
		goal: 'Image',
		author,
		contract
	});
	const design = {
		unitId: 'component.image',
		prompt: 'Image',
		generator: { provider: 'fixture', model: 'none' },
		images: [
			{
				state: 'default',
				viewport: 'desktop' as const,
				bytes: PNG.sync.write(new PNG({ width: 2, height: 2 }))
			}
		]
	};
	const head = git(root, 'rev-parse', 'HEAD');
	for (const command of ['', 'false']) {
		git(root, 'config', '--local', 'filter.lfs.clean', command);
		git(root, 'config', '--local', 'filter.lfs.process', command);
		const config = await readFile(join(root, '.git/config'));
		const index = await readFile(join(root, '.git/index'));
		await expect(api.addDesign(design)).rejects.toThrow('configure repository Git LFS filters');
		expect(git(root, 'rev-parse', 'HEAD')).toBe(head);
		expect(await readFile(join(root, '.git/index'))).toEqual(index);
		expect(await readFile(join(root, '.git/config'))).toEqual(config);
		expect(git(root, 'status', '--porcelain')).toBe('');
		expect((await api.readPlan({ unitId: design.unitId })).versions).toEqual([]);
		await expect(access(join(root, 'src/components/image/designs'))).rejects.toThrow();
	}
	git(root, 'config', '--local', '--unset', 'filter.lfs.process');
	git(root, 'config', '--local', 'filter.lfs.clean', 'git-lfs clean -- %f');
	const created = await api.addDesign(design);
	expect(created.value.version).toBe('v001');
	expect(git(root, 'status', '--porcelain')).toBe('');
});
