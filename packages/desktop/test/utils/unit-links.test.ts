import { expect } from '../../../../test/verificationExpect';
import { test } from 'vitest';
import { createWorkspaceStore, type Workspace } from '../../src/lib/stores/workspace.svelte';
import type { CatalogEntity, EntityDetail, ProjectSnapshot } from '../../src/models/Desktop.types';
import { unitLinks } from '../../src/components/reference-text/unitLinks';

/**
 * A resolver reads the project and revision in view when it is made. It never builds an address
 * of another project or commit for what it read, and nothing resolves while the workspace loads.
 */
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

test('a shell leads under Layouts and a pinned commit is kept in the address', () => {
	expect(unitLinks(alpha())('app.shell.order-frame')).toEqual({
		...{ to: at('layouts/app.shell.order-frame'), name: 'Order frame', category: 'layouts' }
	});
	expect(unitLinks(alpha(earlier))('app.function.format-time')?.to).toBe(
		at(`commit/${earlier}/functions/app.function.format-time`)
	);
});

test('a resolver made for one project and commit resolves nothing once another is shown', () => {
	const shown = alpha();
	const link = unitLinks(shown);
	show(shown, 'local-beta', tip, [frame, time]);
	expect(link('app.shell.order-frame')).toBeNull();
	expect(unitLinks(shown)('app.shell.order-frame')?.to).toBe(
		'/projects/local-beta/harness/branch/feat%2Falpha/layouts/app.shell.order-frame'
	);
	const moved = alpha(earlier);
	const before = unitLinks(moved);
	show(moved, 'local-alpha', next, [frame, time]);
	expect(before('app.shell.order-frame')).toBeNull();
	expect(unitLinks(moved)('app.shell.order-frame')?.to).toContain(`/commit/${next}/`);
});

test('nothing resolves while the workspace loads', () => {
	const shown = alpha();
	const link = unitLinks(shown);
	shown.busy = true;
	expect(link('app.shell.order-frame')).toBeNull();
	expect(unitLinks(shown)('app.shell.order-frame')).toBeNull();
	shown.busy = false;
	expect(link('app.shell.order-frame')?.name).toBe('Order frame');
});

test('a unit removed at the new revision and a draft before the catalog lists it are text', () => {
	const shown = alpha();
	show(shown, 'local-alpha', tip, [time]);
	expect(unitLinks(shown)('app.shell.order-frame')).toBeNull();
	const draft = { ...unit('app.page.refunds', 'pages', 'Refunds'), planned: true };
	expect(unitLinks(shown)('app.page.refunds')).toBeNull();
	show(shown, 'local-alpha', tip, [time, draft]);
	expect(unitLinks(shown)('app.page.refunds')?.to).toBe(at('pages/app.page.refunds'));
});

test('the entity in view is named before its catalog lists it, and only that entity', () => {
	const shown = alpha(tip, [time]);
	const detail = unit('app.page.refunds', 'pages', 'Refunds') as EntityDetail;
	expect(unitLinks(shown, detail)('app.page.refunds')).toBeNull();
	shown.entity = detail;
	expect(unitLinks(shown, detail)('app.page.refunds')?.to).toBe(at('pages/app.page.refunds'));
	const other = unit('app.page.other', 'pages', 'Other');
	expect(unitLinks(shown, other)('app.page.other')).toBeNull();
});

test('an id that is not of the unit grammar never resolves, also when a catalog lists it', () => {
	const shown = alpha(tip, [unit('page:activity', 'pages', 'Activity'), time]);
	expect(unitLinks(shown)('page:activity')).toBeNull();
	expect(unitLinks(createWorkspaceStore())('app.function.format-time')).toBeNull();
});
