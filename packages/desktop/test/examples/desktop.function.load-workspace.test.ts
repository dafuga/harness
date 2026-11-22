import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { loadWorkspace } from '../../src/utils/projects-sessions/load-workspace/loadWorkspace';
import { WorkspaceProjectMismatchError } from '../../src/utils/projects-sessions/load-workspace/loadWorkspace.types';
import type { LoadedWorkspace, ProjectSelection } from '../../src/utils/projects-sessions/load-workspace/loadWorkspace.types';

const projectId = 'local-3f9a0c6e2b1d4a7f8e5c9b0d3a6f1e2c4b7d8a9f0e1c2b3a4d5e6f7a8b9c0d1e';
const commit = '4f2c9a1d7b8e0c35a6f9d2e17b4c8a0f3e5d6b71';
const capabilities = { comments: true, agents: true, planning: true, approval: true, source: 'local' as const };

function snapshot(overrides: Record<string, unknown> = {}) {
	return {
		project: { id: projectId, name: 'sample-app', root: '/workspace/project' },
		capabilities,
		revision: { branch: 'main', commit, tip: commit, atTip: true },
		branches: [],
		commits: [],
		entities: [],
		writable: true,
		...overrides
	} as unknown as LoadedWorkspace['snapshot'];
}

function route(values: Record<string, unknown>) {
	return values as unknown as Parameters<typeof loadWorkspace>[1];
}

function summary(value: LoadedWorkspace) {
	return {
		projectId: value.snapshot.project.id,
		commit: value.snapshot.revision.commit,
		entityId: value.entity?.id ?? null,
		writable: value.snapshot.writable,
		capabilities: value.capabilities,
		offline: value.offline
	};
}

test('reuses selected snapshot for named entity', async () => {
	const selected = snapshot();
	const selection: ProjectSelection = { id: null };
	const calls: string[] = [];
	const bridge = {
		selectProject: async () => { calls.push('select'); return selected; },
		snapshot: async () => { calls.push('snapshot'); return selected; },
		entity: async (input: { entityId: string }) => { calls.push(input.entityId); return { id: input.entityId }; }
	} as unknown as Parameters<typeof loadWorkspace>[0];
	const result = await loadWorkspace(bridge, route({ projectId, branch: null, commit: null, entityId: 'desktop.function.load-workspace', category: 'functions', suffix: null }), selection);
	const output = summary(result);

	expect(calls).toEqual(['select', 'desktop.function.load-workspace']);
	expect(selection.id).toBe(projectId);
	recordExampleCases({ unitId: 'desktop.function.load-workspace', symbol: 'loadWorkspace', state: 'reuses-selected-snapshot-for-named-entity', evidence: 'examples-cases', file: 'reuses-selected-snapshot-for-named-entity.json' }, [
		{ name: 'selected project with an entity address', input: { projectId, entityId: 'desktop.function.load-workspace' }, output }
	]);
});

test('loads requested revision as read-only cached snapshot', async () => {
	const cached = snapshot({ cache: { status: 'offline', cachedAt: '2026-11-13T16:04:27+01:00' } });
	const calls: unknown[] = [];
	const bridge = {
		snapshot: async (input: unknown) => { calls.push(input); return cached; }
	} as unknown as Parameters<typeof loadWorkspace>[0];
	const result = await loadWorkspace(bridge, route({ projectId: null, branch: 'main', commit, entityId: null, category: 'pages', suffix: null }), { id: null });
	const output = summary(result);

	expect(calls).toEqual([{ branch: 'main', commit }]);
	expect(output).toMatchObject({ writable: false, offline: { cachedAt: '2026-11-13T16:04:27+01:00' }, capabilities: { comments: false, agents: false, planning: false, approval: false } });
	recordExampleCases({ unitId: 'desktop.function.load-workspace', symbol: 'loadWorkspace', state: 'loads-requested-revision-as-read-only-cached-snapshot', evidence: 'examples-cases', file: 'loads-requested-revision-as-read-only-cached-snapshot.json' }, [
		{ name: 'cached revision without an entity', input: { branch: 'main', commit }, output }
	]);
});

test('Throws WorkspaceProjectMismatchError when snapshot belongs to another project', async () => {
	const bridge = {
		snapshot: async () => snapshot({ project: { id: 'another-project', name: 'other', root: '/other' } })
	} as unknown as Parameters<typeof loadWorkspace>[0];
	const selection: ProjectSelection = { id: null };
	const input = { projectId, branch: null, commit: null };
	const operation = loadWorkspace(bridge, route({ ...input, entityId: null, category: 'functions', suffix: null }), selection);
	await expect(operation).rejects.toBeInstanceOf(WorkspaceProjectMismatchError);
	await expect(operation).rejects.toThrow('The bridge answered for another project.');
	recordExampleCases({ unitId: 'desktop.function.load-workspace', symbol: 'loadWorkspace', state: 'throws-workspaceprojectmismatcherror-when-snapshot-belongs-t', evidence: 'examples-cases', file: 'throws-workspaceprojectmismatcherror-when-snapshot-belongs-t.json' }, [
		{ name: 'snapshot names a different project', input, error: { name: 'WorkspaceProjectMismatchError', message: 'The bridge answered for another project.' } }
	]);
});
