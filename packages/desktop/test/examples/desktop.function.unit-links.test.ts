import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import {
	createWorkspaceStore,
	type Workspace
} from '../../src/lib/stores/projects-sessions/workspace.svelte';
import type {
	CatalogEntity,
	EntityDetail,
	ProjectSnapshot
} from '../../src/models/development-tooling/Desktop.types';
import { unitLinks } from '../../src/components/explorer-ui/reference-text/unitLinks';

const [tip, earlier, next] = ['a'.repeat(40), 'c'.repeat(40), 'd'.repeat(40)];
const unit = (id: string, category: CatalogEntity['category'], title: string) =>
	({ id, category, kind: category.slice(0, -1), title, planned: false }) as CatalogEntity;
const frame = unit('app.shell.order-frame', 'layouts', 'Order frame');
const time = unit('app.function.format-time', 'functions', 'Format time');

function show(shown: Workspace, project: string, commit: string, entities: CatalogEntity[]) {
	shown.snapshot = {
		project: { name: project, root: `/${project}`, id: project },
		revision: { branch: 'feat/alpha', commit, tip, atTip: commit === tip },
		...{ branches: [], commits: [], entities, writable: commit === tip }
	} as ProjectSnapshot;
	shown.pinned = commit !== tip;
	return shown;
}

const alpha = (commit = tip, entities = [frame, time]) =>
	show(createWorkspaceStore(), 'local-alpha', commit, entities);
const at = (rest: string) => `/projects/local-alpha/harness/branch/feat%2Falpha/${rest}`;

function recordCases(
	symbol: string,
	state: string,
	cases: Parameters<typeof recordExampleCases>[1]
) {
	recordExampleCases(
		{
			unitId: 'desktop.function.unit-links',
			symbol,
			state,
			evidence: 'examples-cases',
			file: `${state}.json`
		},
		cases
	);
}

test('Resolves catalog units to routes for the shown project, branch and commit', () => {
	const tipLink = unitLinks(alpha())('app.shell.order-frame');
	const pinnedLink = unitLinks(alpha(earlier))('app.function.format-time');
	expect(tipLink).toEqual({
		to: at('layouts/app.shell.order-frame'),
		name: 'Order frame',
		category: 'layouts'
	});
	expect(pinnedLink?.to).toBe(at(`commit/${earlier}/functions/app.function.format-time`));
	recordCases(
		'unitLinks',
		'resolves-catalog-units-to-routes-for-the-shown-project-branch-and-commit',
		[
			{
				name: 'tip shell resolves under layouts',
				input: { id: 'app.shell.order-frame', commit: tip },
				output: tipLink
			},
			{
				name: 'pinned function keeps its commit',
				input: { id: 'app.function.format-time', commit: earlier },
				output: pinnedLink
			}
		]
	);
});

test('Refuses references while loading or after the shown revision changes', () => {
	const shown = alpha();
	const link = unitLinks(shown);
	shown.busy = true;
	const loading = link('app.shell.order-frame');
	shown.busy = false;
	const loaded = link('app.shell.order-frame');

	const projectMoved = unitLinks(shown);
	show(shown, 'local-beta', tip, [frame, time]);
	const projectChanged = projectMoved('app.shell.order-frame');

	const commitMoved = alpha(earlier);
	const before = unitLinks(commitMoved);
	show(commitMoved, 'local-alpha', next, [frame, time]);
	const commitChanged = before('app.shell.order-frame');

	const pinOnly = alpha();
	const pinBefore = unitLinks(pinOnly);
	pinOnly.pinned = true;
	const pinChanged = pinBefore('app.shell.order-frame');

	expect(loading).toBeNull();
	expect(loaded?.name).toBe('Order frame');
	expect(projectChanged).toBeNull();
	expect(commitChanged).toBeNull();
	expect(pinChanged).toBeNull();
	recordCases('unitLinks', 'refuses-references-while-loading-or-after-the-shown-revision-changes', [
		{ name: 'busy workspace', input: { busy: true }, output: loading },
		{ name: 'workspace idle again', input: { busy: false }, output: loaded },
		{ name: 'project changed', input: { project: 'local-beta' }, output: projectChanged },
		{ name: 'commit changed', input: { commit: next }, output: commitChanged },
		{ name: 'pin state changed', input: { pinned: true }, output: pinChanged }
	]);
});

test('Resolves the loaded entity only when the catalog omits its id', () => {
	const shown = alpha(tip, [time]);
	const detail = unit('app.page.refunds', 'pages', 'Refunds') as EntityDetail;
	const notSelected = unitLinks(shown, detail)('app.page.refunds');
	shown.entity = detail;
	const selected = unitLinks(shown, detail)('app.page.refunds');
	const otherLink = unitLinks(shown, unit('app.page.other', 'pages', 'Other'))('app.page.other');
	expect(notSelected).toBeNull();
	expect(selected?.to).toBe(at('pages/app.page.refunds'));
	expect(otherLink).toBeNull();
	recordCases('unitLinks', 'resolves-the-loaded-entity-only-when-the-catalog-omits-its-id', [
		{ name: 'entity not yet selected', input: { id: 'app.page.refunds' }, output: notSelected },
		{
			name: 'entity selected and absent from catalog',
			input: { id: 'app.page.refunds' },
			output: selected
		},
		{
			name: 'other entity is not the loaded one',
			input: { id: 'app.page.other' },
			output: otherLink
		}
	]);
});

test('Refuses non-unit, missing and snapshotless references', () => {
	const shown = alpha(tip, [unit('page:activity', 'pages', 'Activity'), time]);
	const nonUnit = unitLinks(shown)('page:activity');
	const missing = unitLinks(alpha())('app.page.missing');
	const snapshotless = unitLinks(createWorkspaceStore())('app.function.format-time');
	expect(nonUnit).toBeNull();
	expect(missing).toBeNull();
	expect(snapshotless).toBeNull();
	recordCases('unitLinks', 'refuses-non-unit-missing-and-snapshotless-references', [
		{ name: 'non-unit id in catalog', input: { id: 'page:activity' }, output: nonUnit },
		{ name: 'id missing from catalog', input: { id: 'app.page.missing' }, output: missing },
		{ name: 'no snapshot loaded', input: { id: 'app.function.format-time' }, output: snapshotless }
	]);
});
