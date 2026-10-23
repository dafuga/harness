import { expect, test } from 'vitest';
import type { HarnessRevision } from '../src/models/Harness.types';
import { entityUsage } from '../src/components/explorer-ui/entity-relations/entityUsage';
import { explorerCategory, explorerRole } from '../src/utils/explorerCategory';
import { explorerEntities } from '../src/utils/explorerEntities';
import { explorerRelations } from '../src/utils/explorerRelations';
import { categoryIcon } from '../src/utils/harnessIcons';
import { harnessShell } from '../src/components/explorer-ui/harness-navbar/harnessShell';
import {
	shellBranch,
	shellCommits,
	shellHref,
	shellIndex,
	shellMount,
	shellScope
} from '../tests/e2e/support/shellData';
import { revision } from './entityFixture';
import { frameId, withFrame } from './entityPreviewData';
import { commits, ids } from './entityUnits';

/**
 * Shells in the explorer: a unit its manifest declares a shell is listed under Shells, after
 * Pages, at the revisions that declare it so. Where it was recorded as a component it stays one.
 */
const framed = (commit: string, kind: string) => withFrame(revision(commit, []), kind);
const frame = frameId;
const categoryOf = (head: HarnessRevision, id: string) =>
	explorerEntities(head).find((entity) => entity.id === id)?.category;

test('the bar has entity categories and a separate Styles screen link', () => {
	const location = { branch: shellBranch, commit: null, category: 'shells' as const };
	const { categories } = harnessShell({
		base: shellMount,
		repository: 'synthetic-repository',
		scope: shellScope(location),
		index: shellIndex,
		commits: shellCommits(shellBranch),
		href: shellHref,
		onroute: () => {}
	});
	expect(categories.map((item) => [item.id, item.label, item.icon, item.active])).toEqual([
		['pages', 'Pages', 'pages', false],
		['shells', 'Shells', 'shells', true],
		['components', 'Components', 'components', false],
		['functions', 'Helpers', 'functions', false],
		['configs', 'Configs', 'configs', false],
		['services', 'Services', 'services', false],
		['models', 'Models', 'database', false],
		['styles', 'Styles', 'styles', false],
		['platforms', 'Platforms', 'platforms', false]
	]);
	expect(categoryIcon.shells).not.toBe(categoryIcon.components);
});

test('a unit declared a shell is a Shell; a component, a partial and a layout stay where they were', () => {
	const owned = (kind: string) => ({
		kind,
		owns: { source: [`src/x/${kind}.svelte`], symbols: [] }
	});
	expect([explorerCategory(owned('shell')), explorerRole(owned('shell'))]).toEqual([
		'shells',
		'Shell'
	]);
	expect(explorerCategory(owned('component'))).toBe('components');
	expect(explorerCategory(owned('partial'))).toBe('components');
	expect([explorerCategory(owned('layout')), explorerRole(owned('layout'))]).toEqual([
		'components',
		'Layout'
	]);
});

test('each revision lists the unit under what its own manifest declares', () => {
	const tip = framed(commits.tip, 'shell');
	const first = framed(commits.first, 'component');
	expect(categoryOf(tip, frame)).toBe('shells');
	expect(categoryOf(first, frame)).toBe('components');
	const shells = explorerEntities(tip).filter((entity) => entity.category === 'shells');
	expect(shells.map((entity) => entity.id)).toEqual([frame]);
	expect(categoryOf(tip, ids.list)).toBe('components');
	// Shells are listed after the pages and before the components.
	const order = explorerEntities(tip).map((entity) => entity.category);
	expect(order.indexOf('shells')).toBeGreaterThan(order.lastIndexOf('pages'));
	expect(order.lastIndexOf('shells')).toBeLessThan(order.indexOf('components'));
});

test('Uses names the shell a page mounts, the shell uses its components, and they are used in both', () => {
	const tip = framed(commits.tip, 'shell');
	const page = entityUsage(explorerRelations(tip, ids.page));
	expect(page.uses.map((group) => [group.title, group.items.map((item) => item.id)])).toEqual(
		expect.arrayContaining([['Shells', [frame]]])
	);
	expect(page.uses[0].title).toBe('Shells');
	const shell = entityUsage(explorerRelations(tip, frame));
	expect(shell.uses.map((group) => group.title)).toEqual(['Components']);
	expect(shell.usedIn.map((item) => item.id)).toEqual([ids.page]);
	const used = entityUsage(explorerRelations(tip, ids.list)).usedIn.map((item) => item.id);
	expect(used).toEqual(expect.arrayContaining([ids.page, frame]));
});
