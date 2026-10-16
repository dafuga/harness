import { expect, test } from 'vitest';
import { isWorkspacePath, workspacePath, workspaceRoute } from '../../src/utils/workspaceRoute';

const commit = 'a'.repeat(40);

test('a project link names project, encoded branch, full commit, entity and section', () => {
	const path = `/projects/local-1/harness/branch/feat%2Factivity/commit/${commit}/pages/page%3Aactivity/history`;
	const route = workspaceRoute(path);
	expect(route).toEqual({
		projectId: 'local-1',
		branch: 'feat/activity',
		commit,
		category: 'pages',
		entityId: 'page:activity',
		suffix: 'history'
	});
	expect(workspacePath(route)).toBe(path);
});

test('a branch link has no commit and a legacy link has no project', () => {
	expect(workspaceRoute('/projects/p/harness/branch/main/services/service.mail/details')).toEqual({
		projectId: 'p',
		branch: 'main',
		commit: null,
		category: 'services',
		entityId: 'service.mail',
		suffix: 'details'
	});
	const legacy = workspaceRoute(`/harness/branch/feat%2Fa%2Fb/commit/${commit}/configs`);
	expect(legacy).toMatchObject({
		projectId: null,
		branch: 'feat/a/b',
		commit,
		category: 'configs'
	});
	expect(workspacePath(legacy)).toBe(`/harness/branch/feat%2Fa%2Fb/commit/${commit}/configs`);
	expect(workspaceRoute(`/harness/commit/${commit}/pages`)).toMatchObject({ branch: null, commit });
});

test('a project link without a revision asks for the tip of the project', () => {
	expect(workspaceRoute('/projects/p/harness/components')).toEqual({
		projectId: 'p',
		branch: null,
		commit: null,
		category: 'components',
		entityId: null,
		suffix: null
	});
	expect(workspaceRoute('/projects/p/harness').category).toBe('pages');
	expect(workspacePath({ projectId: 'p', category: 'functions' })).toBe(
		'/projects/p/harness/functions'
	);
});

test('built links encode what a path cannot carry', () => {
	expect(
		workspacePath({
			projectId: '6f1d2c3b-4a59-4e68-9f70-8a1b2c3d4e5f',
			branch: 'release/1.0',
			commit: null,
			category: 'pages',
			entityId: 'page:a/b',
			suffix: 'details'
		})
	).toBe(
		'/projects/6f1d2c3b-4a59-4e68-9f70-8a1b2c3d4e5f/harness/branch/release%2F1.0/pages/page%3Aa%2Fb/details'
	);
	expect(workspacePath({ branch: 'main', category: 'pages', suffix: 'history' })).toBe(
		'/harness/branch/main/pages'
	);
});

test('an abbreviated commit, an unknown category and a foreign address are refused', () => {
	expect(() => workspaceRoute('/projects/p/harness/branch/main/commit/abc1234/pages')).toThrow(
		/full commit/
	);
	expect(() => workspaceRoute('/projects/p/harness/branch/main/reports')).toThrow(
		'Unknown catalog category'
	);
	expect(() => workspaceRoute('/projects/p/members')).toThrow(/workspace/);
	expect(() => workspaceRoute('/projects//harness/pages')).toThrow(/workspace/);
	expect(isWorkspacePath('/harness/branch/main/pages')).toBe(true);
	expect(isWorkspacePath('/projects/p/harness/pages')).toBe(true);
	expect(isWorkspacePath('/projects/p/members')).toBe(false);
	expect(isWorkspacePath('/')).toBe(false);
});

test('every section of an entity has an address of its own, and its overview has none', () => {
	const entity = '/projects/p/harness/branch/main/pages/page%3Aactivity';
	for (const suffix of ['designs', 'relationships', 'evidence', 'history', 'details'] as const) {
		const route = workspaceRoute(`${entity}/${suffix}`);
		expect(route.suffix).toBe(suffix);
		expect(workspacePath(route)).toBe(`${entity}/${suffix}`);
	}
	expect(workspaceRoute(entity).suffix).toBeNull();
	expect(workspaceRoute(`${entity}/contract`).suffix).toBeNull();
});
