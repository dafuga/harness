import { expect } from '../../../test/verificationExpect';
import { test } from 'vitest';
import { writeFile, readFile, symlink } from 'node:fs/promises';
import { join } from 'node:path';
import { author, contract, git, fixture } from './planFixture';
test('headless versions preserve staged work and invalidate exact approvals without active manifests', async () => {
	const { root, api } = await fixture();
	await writeFile(join(root, 'readme'), 'staged');
	git(root, 'add', 'readme');
	await writeFile(join(root, 'readme'), 'unstaged');
	const before = git(root, 'diff', '--cached');
	const created = await api.createPlan({
		category: 'function',
		slug: 'filter',
		title: 'Filter',
		goal: 'Filter values',
		author,
		contract
	});
	expect(created.value.registered).toBe(false);
	expect(created.value.verified).toBe(false);
	const design = await api.addDesign({
		unitId: 'function.filter',
		prompt: 'Write behavior',
		generator: { provider: 'codex', model: 'selected' },
		images: [],
		notes: 'Returns filtered values'
	});
	const approved = await api.approveDesign({
		unitId: 'function.filter',
		version: design.value.version,
		images: [],
		notesSha256: design.value.notes!.sha256,
		contractHash: design.value.contractHash,
		reviewer: 'Reviewer'
	});
	expect((await api.readPlan({ unitId: 'function.filter' })).lifecycle).toBe('approved');
	await api.addDesign({
		unitId: 'function.filter',
		prompt: 'Revise',
		generator: { provider: 'codex', model: 'selected' },
		images: [],
		notes: 'Revised behavior'
	});
	const detail = await api.readPlan({ unitId: 'function.filter' });
	expect(detail.lifecycle).toBe('review');
	expect(detail.approvals[0].current).toBe(false);
	expect(
		(await api.readPlan({ unitId: 'function.filter', revision: approved.commit })).lifecycle
	).toBe('approved');
	expect(git(root, 'diff', '--cached')).toBe(before);
	expect(await readFile(join(root, 'readme'), 'utf8')).toBe('unstaged');
	expect(git(root, 'ls-tree', '-r', '--name-only', 'HEAD')).not.toContain('specification/units');
	expect(design.value.commit).toBe(design.commit);
	expect(
		git(root, 'show', `${design.commit}:src/functions/filter/designs/v001/design.json`)
	).not.toContain(design.commit);
});
test('serializes concurrent writes and rejects traversal and dirty artifact collisions', async () => {
	const { root, api } = await fixture();
	await expect(
		api.createPlan({
			category: 'function',
			slug: '../escape',
			title: 'Bad',
			goal: 'Bad',
			author,
			contract
		})
	).rejects.toThrow();
	await Promise.all(
		['first', 'second'].map((slug) =>
			api.createPlan({ category: 'function', slug, title: slug, goal: slug, author, contract })
		)
	);
	expect(await api.listPlans()).toHaveLength(2);
	await writeFile(join(root, 'src/functions/first/plan.json'), '{}');
	await expect(
		api.addDesign({
			unitId: 'function.first',
			prompt: 'P',
			generator: { provider: 'codex', model: 'selected' },
			images: [],
			notes: 'N'
		})
	).rejects.toThrow();
});

test('rejects committed immutable tampering and symlink destinations', async () => {
	const { root, api } = await fixture();
	const created = await api.createPlan({
		category: 'function',
		slug: 'safe',
		title: 'Safe',
		goal: 'Safe',
		author,
		contract
	});
	const file = join(root, 'src/functions/safe/plan.json');
	await writeFile(file, (await readFile(file, 'utf8')).replace('Safe', 'Tampered'));
	git(root, 'add', '.');
	git(root, 'commit', '-m', 'tamper');
	await expect(api.readPlan({ unitId: 'function.safe' })).rejects.toThrow('Immutable');
	expect((await api.readPlan({ unitId: 'function.safe', revision: created.commit })).title).toBe(
		'Safe'
	);
	await symlink(join(root, 'src/functions/safe'), join(root, 'src/functions/unsafe'));
	await expect(
		api.createPlan({
			category: 'function',
			slug: 'unsafe',
			title: 'Unsafe',
			goal: 'Unsafe',
			author,
			contract
		})
	).rejects.toThrow();
});
