import { expect, test } from 'vitest';
import { writeFile, rm } from 'node:fs/promises';
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
