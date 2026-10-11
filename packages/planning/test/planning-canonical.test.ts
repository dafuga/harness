import { expect, test } from 'vitest';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { author, contract, fixture, git } from './planFixture';
test('canonical IDs stay exact across plans, threads and revision history', async () => {
	const { root, api } = await fixture();
	await mkdir(join(root, 'specification/units'), { recursive: true });
	await writeFile(
		join(root, 'specification/units/reports.component.select.json'),
		JSON.stringify({ id: 'reports.component.select', kind: 'component' })
	);
	git(root, 'add', '.');
	git(root, 'commit', '-m', 'register existing component');
	const created = await api.createPlan({
		unitId: 'reports.component.select',
		category: 'component',
		slug: 'select',
		title: 'Select',
		goal: 'Plan existing Select',
		author,
		contract
	});
	expect(created.value.unitId).toBe('reports.component.select');
	expect(created.value.registered).toBe(true);
	expect(created.value.path).toBe('src/components/select');
	const thread = await api.openThread({
		unitId: 'reports.component.select',
		version: null,
		file: null,
		imageSha256: null,
		region: null,
		author,
		message: { author, mode: 'plan', body: 'Improve existing component' }
	});
	expect(thread.value.unitId).toBe('reports.component.select');
	expect((await api.snapshot()).plans.map((p) => p.unitId)).toEqual(['reports.component.select']);
	expect(
		(await api.readPlan({ unitId: 'reports.component.select', revision: created.commit })).threads
	).toEqual([]);
	expect(
		(await api.entityHistory({ unitId: 'reports.component.select' })).entries.map((e) => e.commit)
	).toEqual([thread.commit, created.commit]);
	await expect(api.readPlan({ unitId: 'component.select' })).rejects.toThrow();
	await expect(
		api.createPlan({
			unitId: 'reports.component.select',
			category: 'component',
			slug: 'duplicate',
			title: 'Duplicate',
			goal: 'Duplicate',
			author,
			contract
		})
	).rejects.toThrow();
});
test('refuses unattested IDs, canonical category mismatches and traversal', async () => {
	const { root, api } = await fixture();
	await mkdir(join(root, 'specification/units'), { recursive: true });
	await writeFile(
		join(root, 'specification/units/reports.component.select.json'),
		JSON.stringify({ id: 'reports.component.select', kind: 'component' })
	);
	git(root, 'add', '.');
	git(root, 'commit', '-m', 'register existing component');
	const input = {
		category: 'service' as const,
		slug: 'select',
		title: 'Select',
		goal: 'Select',
		author,
		contract
	};
	await expect(api.createPlan({ ...input, unitId: 'reports.component.select' })).rejects.toThrow();
	await expect(api.createPlan({ ...input, unitId: 'unknown.service.select' })).rejects.toThrow();
	await expect(api.createPlan({ ...input, unitId: '../escape' })).rejects.toThrow();
	expect(await api.listPlans()).toEqual([]);
});
