import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { createRemoteHostStore } from '../../src/lib/stores/networking-security/remoteHost.svelte';
import type { Workspace } from '../../src/lib/stores/projects-sessions/workspace.svelte.types';

// prettier-ignore
export const approval = { pairingId: 'pairing-1', deviceId: 'device-1', projectIds: ['project-1'], agents: false };

/** Writes this state's trace: its case is named after the state, and its file after the state. */
export function record(state: string, symbol: string, output: unknown) {
	recordExampleCases(
		{
			unitId: 'desktop.store.remote-host',
			symbol,
			state,
			evidence: 'examples-cases',
			file: `${state}.json`
		},
		[{ name: state, input: null, output }]
	);
}

export const workspaceWith = (host: unknown) => ({ remote: { host } }) as unknown as Workspace;

test('Without a control port start returns unsubscribed and every action resolves false', async () => {
	const store = createRemoteHostStore(workspaceWith(undefined));
	const started = await store.start();
	const results = [
		await store.enable(),
		await store.disable(),
		await store.createPairing(),
		await store.closePairing(),
		await store.approve(approval),
		await store.deny('pairing-1'),
		await store.revoke('device-1')
	];

	expect(started).toBeUndefined();
	expect(results).toEqual([false, false, false, false, false, false, false]);
	expect(store.status).toBeNull();
	expect(store.busy).toBe(false);
	record('absent-port-resolves-every-action-false', 'createRemoteHostStore', {
		started: null,
		results
	});
});
