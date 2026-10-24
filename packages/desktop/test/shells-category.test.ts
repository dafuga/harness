import { measureWorkload } from '../../../test/support/measureWorkload';
import { expect } from '../../../test/verificationExpect';
import { afterEach, test, vi } from 'vitest';
import { createWorkspaceStore } from '../src/lib/stores/workspace.svelte';
import { categories, type ProjectSnapshot } from '../src/models/Desktop.types';
import type { DesktopBridge } from '../src/models/DesktopBridge.types';
import { categoryOf } from '../src/utils/categoryOf';
import { ipcPayload } from '../src/utils/ipc-payload/ipcPayload';
import type { Preparation } from '../src/utils/prepareRun';
import { imageModel } from '../src/utils/prepareRun';
import { isWorkspacePath, workspacePath, workspaceRoute } from '../src/utils/workspaceRoute';

/**
 * Shells in the shared app: a category after Pages, an address of its own, and the place an old
 * Components address of a shell leads to. A shell is planned with images, as a component is.
 */
afterEach(() => vi.unstubAllGlobals());
const shell = 'desktop.component.workspace-shell';
const [commit, tip] = ['a'.repeat(40), 'b'.repeat(40)];

test('the shared app has seven categories, Shells after Pages', () => {
	expect([...categories]).toEqual([
		'pages',
		'apis',
		'layouts',
		'components',
		'functions',
		'configs',
		'services',
		'models'
	]);
});

test('a unit declared a shell is a Shell, and every other kind stays where it was', () =>
	measureWorkload('desktop.function.category-of', 'layout-catalog-behavior', () => {
		expect(categoryOf('shell')).toBe('components');
		expect(categoryOf('layout')).toBe('layouts');
		expect(categoryOf('component')).toBe('components');
		expect(categoryOf('model')).toBe('models');
		expect(categoryOf('page')).toBe('pages');
		expect(categoryOf('shared-function')).toBe('functions');
	}));

test('a shell has a workspace address with its project, branch, commit and section', () => {
	const path = `/projects/p/harness/branch/feat%2Fx/commit/${commit}/layouts/${shell}/details`;
	const route = workspaceRoute(path);
	expect(route).toEqual({
		projectId: 'p',
		branch: 'feat/x',
		commit,
		category: 'layouts',
		entityId: shell,
		suffix: 'source'
	});
	expect(workspacePath(route)).toBe(path.replace(/\/details$/, '/source'));
	expect(isWorkspacePath('/harness/shells')).toBe(true);
	expect(workspaceRoute('/harness/branch/main/shells').category).toBe('layouts');
});

/** A workspace over a bridge whose entity has the category its manifest gives it at that commit. */
function opened(category: string) {
	const snapshot = vi.fn(async (query: { commit: string | null }) => ({
		revision: { branch: 'main', commit: query.commit ?? tip, tip, atTip: !query.commit },
		entities: [],
		branches: [],
		commits: [],
		writable: !query.commit,
		project: { name: 'fixture', root: '/tmp/fixture' }
	})) as unknown as () => Promise<ProjectSnapshot>;
	const entity = vi.fn(async () => ({ id: shell, category }));
	const history = { pushState: vi.fn(), replaceState: vi.fn() };
	vi.stubGlobal('history', history);
	const store = createWorkspaceStore();
	store.connect({ snapshot, entity } as unknown as DesktopBridge);
	return { store, history };
}

test('an old Components address of a shell opens it under Shells, keeping its section', async () => {
	const { store, history } = opened('layouts');
	await store.navigate(`/harness/branch/main/components/${shell}/details`);
	expect(store.category).toBe('layouts');
	expect(history.pushState).toHaveBeenCalledWith(
		{},
		'',
		`/harness/branch/main/layouts/${shell}/source`
	);
	await store.navigate(`/harness/branch/main/components/${shell}/history`, false);
	expect(history.replaceState).toHaveBeenCalledWith(
		{},
		'',
		`/harness/branch/main/layouts/${shell}/history`
	);
});

test('at a commit that recorded it as a component, its Components address stays', async () => {
	const { store, history } = opened('components');
	const path = `/harness/branch/main/commit/${commit}/components/${shell}`;
	await store.navigate(path);
	expect(store.category).toBe('components');
	expect(history.pushState).toHaveBeenCalledWith({}, '', path);
});

test('plans and agent requests may name Shells, and a shell plan needs the image capability', () =>
	measureWorkload('desktop.function.prepare-run', 'layout-catalog-behavior', async () => {
		expect(
			ipcPayload('plan:create', {
				category: 'layouts',
				title: 'Host frame',
				goal: 'Frames a host.'
			})
		).toMatchObject({ category: 'layouts' });
		const request = {
			intent: 'create',
			projectId: 'local-' + 'a'.repeat(64),
			category: 'layouts',
			mode: 'plan',
			provider: 'codex',
			model: 'listed',
			effort: null,
			text: 'Add a frame for hosts'
		};
		expect(ipcPayload('run:start', request)).toMatchObject({ category: 'layouts' });
		const provider = (imageGeneration: boolean) =>
			({
				providers: {
					list: async () => [
						{
							id: 'codex',
							available: true,
							imageGeneration,
							models: [{ id: 'default-model', isDefault: true }]
						}
					]
				}
			}) as unknown as Preparation;
		await expect(imageModel(provider(false), { mode: 'plan' }, 'layouts')).rejects.toThrow(
			/GPT Image/
		);
		expect(await imageModel(provider(true), { mode: 'plan' }, 'layouts')).toBe('default-model');
		expect(await imageModel(provider(false), { mode: 'plan' }, 'functions')).toBe('');
	}));
