import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { createHostedConnectionStore } from '../../src/lib/stores/networking-security/hostedConnection.svelte';
import type { HostedConnection } from '../../src/lib/stores/networking-security/hostedConnection.svelte.types';
import type { Workspace } from '../../src/lib/stores/projects-sessions/workspace.svelte.types';

test('loads hosted status and refreshes projects', async () => {
	const loaded: string[] = [];
	const status = { configured: true, state: 'signed-out' as const };
	const workspace = {
		bridge: {
			hostedStatus: async () => status,
			connectHosted: async () => status,
			disconnectHosted: async () => status
		},
		loadProjects: async () => {
			loaded.push('projects');
		},
		invalidate: () => undefined
	} as unknown as Workspace;
	const store: HostedConnection = createHostedConnectionStore(workspace);
	await store.load();
	const output = { status: store.status, error: store.error, busy: store.busy, loaded };

	expect(store.status).toEqual(status);
	expect(store.error).toBe('');
	expect(loaded).toEqual(['projects']);
	recordExampleCases(
		{
			unitId: 'desktop.store.hosted-connection',
			symbol: 'load',
			state: 'loads-hosted-status-and-refreshes-projects',
			evidence: 'examples-cases',
			file: 'loads-hosted-status-and-refreshes-projects.json'
		},
		[{ name: 'load signed-out hosted status', input: null, output }]
	);
});
