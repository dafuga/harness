import { measureWorkload } from './support/measureWorkload';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { canonicalJson } from '../src/utils/canonicalJson';
import {
	explorerCategories,
	explorerKindCategory,
	explorerRoute,
	explorerRoutePath
} from '../src/utils/explorerRoute';
import { planningArtifactPaths } from '../src/audit/structure-rules/planningArtifactPaths';

/**
 * Shells: the composition of an app is a category of its own, after Pages. Only a unit declared a
 * shell is listed there; what was a component, a partial or a layout stays where it was.
 */
const commit = 'a'.repeat(40);
const shell = 'desktop.component.workspace-shell';

test('the explorer has entity categories, Layouts after Pages', () => {
	expect([...explorerCategories]).toEqual([
		'pages',
		'layouts',
		'components',
		'functions',
		'configs',
		'services',
		'models',
		'types',
		'platforms'
	]);
});

test('layout frames have their own collection while shell hosts remain components', () => {
	expect(explorerKindCategory('layout')).toBe('layouts');
	for (const kind of ['component', 'partial', 'shell']) {
		expect([kind, explorerKindCategory(kind)]).toEqual([kind, 'components']);
	}
});

test('a shell has an address at a branch tip and at a selected commit, with its section and tab', () => {
	const at = explorerRoute(
		`/branch/feat%2Fx/commit/${commit}/shells/${shell}/details`,
		'?tab=source'
	);
	expect(at).toEqual({
		branch: 'feat/x',
		commit,
		category: 'layouts',
		entity: shell,
		section: 'details',
		tab: 'source'
	});
	expect(explorerRoutePath(at!)).toBe(
		`/branch/feat%2Fx/commit/${commit}/layouts/${shell}?tab=source`
	);
	expect(explorerRoute('/branch/main/shells')).toEqual({
		branch: 'main',
		commit: null,
		category: 'layouts'
	});
	expect(explorerRoute(`/commit/${commit}/shells/${shell}/history`)).toEqual({
		branch: null,
		commit,
		category: 'layouts',
		entity: shell,
		section: 'history'
	});
});

test('the plan of a new shell is a planning artifact of its own folder, as a component plan is', () =>
	measureWorkload('function.planning-artifact-paths', 'layout-catalog-behavior', async () => {
		const root = await mkdtemp(join(tmpdir(), 'harness-shell-plan-'));
		const contract = {
			responsibility: 'Frames the workspace of a host.',
			inputs: [],
			outputs: [],
			errors: [],
			states: ['default'],
			viewports: ['desktop']
		};
		const plan = {
			unitId: 'shell.host-frame',
			category: 'shell',
			slug: 'host-frame',
			path: 'src/shells/host-frame',
			title: 'Host frame',
			goal: 'Frames the workspace of a host.',
			createdAt: '2026-10-14T08:00:00.000Z',
			createdBy: { kind: 'person', name: 'Local reviewer' },
			baseRevision: commit,
			contract,
			contractHash: createHash('sha256').update(canonicalJson(contract)).digest('hex')
		};
		await mkdir(join(root, plan.path), { recursive: true });
		await writeFile(join(root, plan.path, 'plan.json'), JSON.stringify(plan));
		const files = [`${plan.path}/plan.json`, `${plan.path}/designs/v001/design.json`];
		expect([...planningArtifactPaths(root, files)].sort()).toEqual([
			'src/',
			'src/shells/',
			'src/shells/host-frame/',
			'src/shells/host-frame/designs/',
			'src/shells/host-frame/designs/v001/',
			'src/shells/host-frame/designs/v001/design.json',
			'src/shells/host-frame/plan.json'
		]);
	}));
