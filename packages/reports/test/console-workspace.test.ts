import { expect } from '../../../test/verificationExpect';
import { afterEach, test, vi } from 'vitest';
import { createConsoleWorkspaceStore } from '../src/lib/stores/consoleWorkspace.svelte';
const commit = 'a'.repeat(40);
const entity = {
	id: 'app.component.chat',
	category: 'components',
	title: 'Chat',
	versions: [],
	threads: []
};
const snapshot = {
	project: { id: 'local-1', root: '', name: 'Harness' },
	revision: { branch: 'main', commit, tip: commit, atTip: true },
	entities: [entity],
	writable: true,
	capabilities: { agents: true, comments: true, planning: true, approval: true, source: 'local' }
};
afterEach(() => vi.unstubAllGlobals());
test('chat references navigate the standalone explorer to scoped entity history', async () => {
	vi.stubGlobal(
		'fetch',
		vi.fn(async (_url, init) => {
			const { method } = JSON.parse(init.body);
			const answers: Record<string, unknown> = {
				connect: { token: 'fixture-token', snapshot },
				snapshot,
				entity,
				capabilities: snapshot.capabilities
			};
			const result = answers[method] ?? null;
			return Response.json(result);
		})
	);
	const navigate = vi.fn();
	const host = createConsoleWorkspaceStore(navigate);
	await host.workspace.navigate('/harness/branch/main/pages', false);
	await host.workspace.navigate('/harness/branch/main/components/app.component.chat/history');
	expect(navigate).toHaveBeenLastCalledWith(
		'/branch/main/components/app.component.chat/history',
		false
	);
	expect(host.workspace.error).toBe('');
	host.close();
});

test('module screens retain revision-scoped project chat without selecting a source entity', async () => {
	vi.stubGlobal(
		'fetch',
		vi.fn(async (_url, init) => {
			const { method, input } = JSON.parse(init.body);
			const selected = {
				...snapshot,
				writable: !input?.commit,
				revision: {
					...snapshot.revision,
					branch: input?.branch ?? 'main',
					commit: input?.commit ?? commit
				}
			};
			const answers: Record<string, unknown> = {
				connect: { token: 'fixture-token', snapshot },
				snapshot: selected,
				capabilities: snapshot.capabilities
			};
			return Response.json(answers[method] ?? null);
		})
	);
	const navigate = vi.fn();
	const host = createConsoleWorkspaceStore(navigate);
	try {
		for (const route of ['/modules', '/modules/email', '/module-resources/email.email']) {
			for (const at of ['', `/commit/${commit}`]) {
				await host.workspace.navigate(`/harness/branch/feature%2Fmodules${at}${route}`, false);
				expect(host.workspace.error).toBe('');
				expect(host.workspace.category).toBe('pages');
				expect(host.workspace.entity).toBeNull();
				expect(host.workspace.snapshot?.revision.branch).toBe('feature/modules');
				expect(host.workspace.pinned).toBe(Boolean(at));
			}
		}
		expect(navigate).not.toHaveBeenCalled();
	} finally {
		host.close();
	}
});
