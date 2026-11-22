import { beforeEach, test, vi } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { createProjectAgentStore } from '../../src/lib/stores/agents-providers/projectAgent.svelte';
import type { Workspace } from '../../src/lib/stores/projects-sessions/workspace.svelte.types';
import type { RunDraft } from '../../src/utils/explorer-ui/composeModes';
import {
	projectAgentActions,
	projectAgentComment
} from '../../src/utils/agents-providers/projectAgentActions';

vi.mock('../../src/utils/agents-providers/projectAgentActions', () => ({
	projectAgentActions: vi.fn(),
	projectAgentComment: vi.fn()
}));

const PROJECT = 'project-alpha';

/** A synthetic bridge: every method is a spy, no transport or model is reached. */
function syntheticBridge() {
	return {
		providers: vi.fn(async () => [{ id: 'local', label: 'Local', models: ['example-model'] }]),
		onRunEvent: vi.fn(() => vi.fn()),
		startRun: vi.fn(async () => ({ runId: 'run-1' })),
		cancelRun: vi.fn(async () => undefined),
		addComment: vi.fn(async () => ({ kind: 'shared' }))
	};
}

/** A writable tip of an agent-capable project; overrides turn it into other states. */
function workspaceWith(
	bridge: ReturnType<typeof syntheticBridge> | undefined,
	overrides: Record<string, unknown> = {}
) {
	return {
		projectId: PROJECT,
		busy: false,
		error: '',
		pinned: false,
		snapshot: { writable: true, revision: { branch: 'main', commit: 'abc123' } },
		capabilities: { agents: true, comments: true },
		bridge,
		context: { projectId: PROJECT },
		...overrides
	} as unknown as Workspace;
}

function recordCases(state: string, cases: Parameters<typeof recordExampleCases>[1]) {
	recordExampleCases(
		{
			unitId: 'desktop.store.project-agent',
			symbol: 'projectAgent',
			state,
			evidence: 'examples-cases',
			file: `${state}.json`
		},
		cases
	);
}

/** Captures what a rejected call throws without assuming a particular error class. */
async function thrownBy(action: () => Promise<unknown>): Promise<{ thrown: unknown }> {
	try {
		await action();
	} catch (thrown) {
		return { thrown };
	}
	return { thrown: undefined };
}

beforeEach(() => {
	vi.clearAllMocks();
});

test('Creates an idle store per call and makes no bridge call until a method runs', () => {
	const bridge = syntheticBridge();
	const workspace = workspaceWith(bridge);
	const first = createProjectAgentStore(workspace);
	const second = createProjectAgentStore(workspace);
	const initial = {
		runId: first.runId,
		status: first.status,
		error: first.error,
		asked: first.asked,
		said: first.said,
		saved: first.saved,
		providers: first.providers,
		messages: first.messages,
		starting: first.starting,
		active: first.active
	};
	expect(first).not.toBe(second);
	expect(initial).toEqual({
		runId: '',
		status: '',
		error: '',
		asked: '',
		said: '',
		saved: null,
		providers: [],
		messages: [],
		starting: false,
		active: false
	});
	expect(second.runId).toBe('');
	expect(bridge.providers).not.toHaveBeenCalled();
	expect(bridge.onRunEvent).not.toHaveBeenCalled();
	expect(bridge.startRun).not.toHaveBeenCalled();
	recordCases('creates-idle-stores-and-makes-no-bridge-calls-until-used', [
		{
			name: 'create two stores over one workspace',
			input: { projectId: PROJECT },
			output: { distinct: first !== second, initial }
		},
		{
			name: 'bridge calls after creation',
			input: { bridge: 'synthetic' },
			output: {
				providers: bridge.providers.mock.calls.length,
				onRunEvent: bridge.onRunEvent.mock.calls.length
			}
		}
	]);
});

test('Gates modes and providers on an allowed writable tip and loads them once', async () => {
	const bridge = syntheticBridge();
	const open = createProjectAgentStore(workspaceWith(bridge));
	const pinned = createProjectAgentStore(workspaceWith(bridge, { pinned: true }));
	const unsubscribe = open.listen();
	open.loadProviders();
	open.loadProviders();
	await Promise.resolve();
	await Promise.resolve();
	const summary = {
		allowed: open.allowed,
		modes: open.modes,
		pinnedAllowed: pinned.allowed,
		pinnedModes: pinned.modes,
		providers: open.providers.map(({ id }) => id),
		listened: typeof unsubscribe
	};
	expect(summary).toMatchObject({
		allowed: true,
		modes: ['plan', 'ask', 'change', 'comment'],
		pinnedAllowed: false,
		pinnedModes: ['comment'],
		providers: ['local'],
		listened: 'function'
	});
	expect(bridge.providers).toHaveBeenCalledTimes(1);
	pinned.loadProviders();
	expect(bridge.providers).toHaveBeenCalledTimes(1);
	recordCases('gates-modes-and-providers-on-allowed-writable-tip', [
		{
			name: 'open tip modes and providers',
			input: { projectId: PROJECT, pinned: false },
			output: summary
		},
		{
			name: 'pinned commit stays read-only',
			input: { pinned: true },
			output: { allowed: pinned.allowed, modes: pinned.modes }
		}
	]);
});

test('Throws synchronously from loadProviders when allowed without a bridge and never retries', () => {
	const noBridge = createProjectAgentStore(workspaceWith(undefined));
	const { thrown } = (() => {
		try {
			noBridge.loadProviders();
			return { thrown: undefined };
		} catch (error) {
			return { thrown: error };
		}
	})();
	expect(thrown).toBeInstanceOf(TypeError);
	expect(noBridge.error).toBe('');
	const bridge = syntheticBridge();
	noBridge.workspace.bridge = bridge as unknown as Workspace['bridge'];
	noBridge.loadProviders();
	expect(bridge.providers).not.toHaveBeenCalled();
	recordCases('throws-when-loading-providers-without-a-bridge', [
		{
			name: 'loadProviders with allowed tip and no bridge',
			input: { bridge: 'undefined' },
			error: thrown instanceof Error ? `${thrown.name}: ${thrown.message}` : String(thrown)
		},
		{
			name: 'retry after a bridge appears',
			input: { bridge: 'synthetic' },
			output: { providerCalls: bridge.providers.mock.calls.length, storedError: noBridge.error }
		}
	]);
});

test('Propagates send and comment rejections to the caller', async () => {
	const bridge = syntheticBridge();
	const store = createProjectAgentStore(workspaceWith(bridge));
	const draft = { text: 'Explain the layout', mode: 'ask' } as RunDraft;
	const sendReason = { code: 'send-refused' };
	const commentReason = { code: 'comment-refused' };
	vi.mocked(projectAgentActions).mockResolvedValueOnce(true);
	const resolved = await store.send(draft);
	vi.mocked(projectAgentActions).mockRejectedValueOnce(sendReason);
	const sent = await thrownBy(() => store.send(draft));
	vi.mocked(projectAgentComment).mockRejectedValueOnce(commentReason);
	const commented = await thrownBy(() => store.comment('Looks right'));
	expect(resolved).toBe(true);
	expect(vi.mocked(projectAgentActions).mock.calls[0]?.[0]).toBe(store);
	expect(vi.mocked(projectAgentActions).mock.calls[0]?.[1]).toBe(draft);
	expect(sent.thrown).toBe(sendReason);
	expect(commented.thrown).toBe(commentReason);
	recordCases('propagates-send-and-comment-rejections-to-caller', [
		{ name: 'send resolves with the action result', input: { mode: 'ask' }, output: resolved },
		{
			name: 'send rejection reaches the caller',
			input: { mode: 'ask' },
			output: { rethrown: sent.thrown === sendReason }
		},
		{
			name: 'comment rejection reaches the caller',
			input: { text: 'Looks right' },
			output: { rethrown: commented.thrown === commentReason }
		}
	]);
});
