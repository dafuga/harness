import { expect } from '../../../test/verificationExpect';
import { test, vi } from 'vitest';
import { createProjectAgentStore } from '../src/lib/stores/projectAgent.svelte';
import type { Workspace } from '../src/lib/stores/workspace.svelte';
import type { ProjectRunRequest, RunEvent } from '../src/models/DesktopBridge.types';

/**
 * The project agent keeps what its own run said in public, as text events arrive, with the
 * request as it was written. Another run is not heard, and a new request starts a new reply.
 */
function shown() {
	let follow: (event: RunEvent) => void = () => {};
	let runs = 0;
	const bridge = {
		providers: vi.fn(async () => []),
		startRun: vi.fn(async (_request: ProjectRunRequest) => ({ runId: `run-${++runs}` })),
		onRunEvent: (listener: typeof follow) => {
			follow = listener;
			return () => {};
		}
	};
	const workspace = {
		...{ bridge, category: 'pages', pinned: false, capabilities: { agents: true } },
		...{ snapshot: { writable: true }, projectId: 'local-1', context: { projectId: 'local-1' } },
		refresh: vi.fn(async () => {}),
		navigate: vi.fn(async () => {})
	};
	const agent = createProjectAgentStore(workspace as unknown as Workspace);
	agent.listen();
	const emit = (runId: string, event: object) => follow({ runId, ...event } as RunEvent);
	return { agent, bridge, emit };
}
const draft = (text: string) => ({
	...{ mode: 'plan' as const, provider: 'codex' as const, model: 'listed', effort: null, text }
});

test('the text of the own run is kept as it arrives, beside the request as written', async () => {
	const f = shown();
	const request = 'Add refunds beside [[unit:app.shell.order-frame]]';
	const sent = f.agent.send(draft(request));
	await expect.poll(() => f.agent.runId).toBe('run-1');
	f.emit('run-1', { kind: 'text', text: 'Should it reuse [[unit:app.function.form' });
	f.emit('run-2', { kind: 'text', text: 'Another run.' });
	f.emit('run-1', { kind: 'text', text: 'at-time]]?' });
	expect(f.agent.said).toBe('Should it reuse [[unit:app.function.format-time]]?');
	expect(f.agent.asked).toBe(request);
	expect(f.bridge.startRun.mock.calls[0][0]).toMatchObject({ text: request });
	f.emit('run-1', { kind: 'failed', message: "The agent's proposal was not used." });
	await expect(sent).resolves.toBe(false);
	expect(f.agent.said).toBe('Should it reuse [[unit:app.function.format-time]]?');
	const again = f.agent.send(draft('Yes, reuse it.'));
	await expect.poll(() => f.agent.runId).toBe('run-2');
	expect(f.agent.said).toBe('');
	f.emit('run-2', { kind: 'cancelled' });
	await expect(again).resolves.toBe(false);
});
