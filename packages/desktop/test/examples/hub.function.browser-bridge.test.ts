import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { HostedAgentUnavailableError } from '../../src/adapters/explorer-ui/browser-project-adapter/HostedAgentUnavailableError';
import { ProjectIdRequiredError } from '../../src/adapters/explorer-ui/browser-project-adapter/ProjectIdRequiredError';
import { browserBridge } from '../../src/adapters/explorer-ui/browser-project-adapter/browserBridge';
import type { BrowserApi } from '../../src/models/development-tooling/BrowserApi.types';
import type { Replies, Bridge, Cases } from './hub.function.browser-bridge.test.types';

const shownCaps = { comments: true, agents: true, planning: true, approval: true, source: 'local' };

/** A fake port: each request is recorded as "METHOD path" and answered from the replies map. */
function fakeApi(replies: Replies, calls: string[]): BrowserApi {
	const answer = <T>(key: string): Promise<T> => {
		calls.push(key);
		const reply = replies[key];
		return reply instanceof Error ? Promise.reject(reply) : Promise.resolve(reply as T);
	};
	return {
		media: async () => ({ bytes: new Uint8Array(), mediaType: 'image/png' }),
		get: <T>(path: string) => answer<T>(`GET ${path}`),
		send: <T>(method: 'POST' | 'DELETE', path: string) => answer<T>(`${method} ${path}`),
		bytes: async () => new Uint8Array([1, 2, 3])
	};
}

function bridgeWith(replies: Replies): { bridge: Bridge; calls: string[] } {
	const calls: string[] = [];
	return { bridge: browserBridge(fakeApi(replies, calls)) as Bridge, calls };
}

function snapshotFor(projectId: string, capabilities: unknown, writable: boolean) {
	return {
		project: { id: projectId, name: 'Example' },
		capabilities,
		revision: { branch: 'main', commit: 'abc123' },
		branches: [],
		commits: [],
		entities: [],
		writable
	};
}

function refusedWith(status: number): Error {
	return Object.assign(new Error(`Refused ${status}`), { status });
}

/** The error a call rejects with; fails the test if the call succeeds. Covers synchronous throws too. */
async function rejection(run: () => Promise<unknown>): Promise<Error> {
	try {
		await run();
	} catch (error) {
		return error as Error;
	}
	throw new Error('Expected the call to reject.');
}

function summary(error: Error) {
	return { name: error.name, message: error.message };
}

function record(state: string, cases: Cases) {
	recordExampleCases(
		{
			unitId: 'hub.function.browser-bridge',
			symbol: 'browserBridge',
			state,
			evidence: 'examples-cases',
			file: `${state}.json`
		},
		cases
	);
}

test('Lists the server projects as shared', async () => {
	const { bridge, calls } = bridgeWith({
		'GET /api/projects': [{ id: 'proj-1', name: 'Example' }]
	});
	const projects = await bridge.listProjects();
	expect(projects).toEqual([{ id: 'proj-1', name: 'Example', kind: 'shared' }]);
	expect(calls).toEqual(['GET /api/projects']);
	record('lists-the-server-projects-as-shared', [
		{
			name: 'one server project is listed as shared',
			input: { serverProjects: 1 },
			output: projects
		}
	]);
});

test('Grants access only to capabilities that are exactly true', async () => {
	const flagged = {
		comments: true,
		agents: 'yes',
		planning: true,
		approval: false,
		source: 'local',
		reason: 'Trial'
	};
	const { bridge } = bridgeWith({
		'GET /api/projects/proj-1/snapshot': snapshotFor('proj-1', flagged, true),
		'GET /api/projects/proj-2/snapshot': snapshotFor('proj-2', shownCaps, true)
	});
	const first = await bridge.selectProject({ projectId: 'proj-1' });
	const second = await bridge.selectProject({ projectId: 'proj-2' });
	const caps = await bridge.capabilities({ projectId: 'proj-1' });
	expect(caps).toEqual({
		comments: true,
		agents: false,
		planning: true,
		approval: false,
		source: 'github',
		reason: 'Trial'
	});
	expect(first.writable).toBe(false);
	expect(second.writable).toBe(true);
	record('grants-access-only-to-capabilities-that-are-exactly-true', [
		{
			name: 'a non-true agents flag is denied',
			input: { projectId: 'proj-1', agents: 'yes' },
			output: caps
		},
		{
			name: 'writable needs the agents capability',
			input: { projectId: 'proj-2' },
			output: { writable: second.writable }
		}
	]);
});

test('Refuses plan creation without sending a request', async () => {
	const { bridge, calls } = bridgeWith({});
	const error = await rejection(() => bridge.createPlan({ projectId: 'proj-1' } as never));
	expect(error).toBeInstanceOf(HostedAgentUnavailableError);
	expect(summary(error)).toEqual({
		name: 'HostedAgentUnavailableError',
		message: 'The hosted workspace shows projects and comments. It runs no agent.'
	});
	expect(calls).toEqual([]);
	record('refuses-plan-creation-without-sending-a-request', [
		{ name: 'plan creation is refused', input: { projectId: 'proj-1' }, error: summary(error) }
	]);
});

test('Rejects a read or comment that names no project', async () => {
	const { bridge, calls } = bridgeWith({});
	const seen: unknown[] = [];
	bridge.onCacheStatus((status) => seen.push(status));
	const read = await rejection(() => bridge.selectProject({} as never));
	const write = await rejection(() => bridge.addComment({} as never));
	expect(read).toBeInstanceOf(ProjectIdRequiredError);
	expect(summary(read).message).toBe('Name the project this is asked for.');
	expect(write).toBeInstanceOf(ProjectIdRequiredError);
	expect(seen).toEqual([]);
	expect(calls).toEqual([]);
	record('rejects-a-read-or-comment-that-names-no-project', [
		{ name: 'read without a project id', input: {}, error: summary(read) },
		{ name: 'comment without a project id', input: {}, error: summary(write) }
	]);
});

test('Tells listeners a refused read is denied before it rethrows', async () => {
	const unauthorized = refusedWith(401);
	const forbidden = refusedWith(403);
	const { bridge } = bridgeWith({
		'GET /api/projects/proj-1/snapshot': unauthorized,
		'GET /api/projects/proj-2/snapshot': forbidden
	});
	const seen: unknown[] = [];
	bridge.onCacheStatus((status) => seen.push(status));
	const thrown401 = await rejection(() => bridge.selectProject({ projectId: 'proj-1' }));
	const thrown403 = await rejection(() => bridge.selectProject({ projectId: 'proj-2' }));
	expect(thrown401).toBe(unauthorized);
	expect(thrown403).toBe(forbidden);
	expect(seen).toEqual([
		{ projectId: '$projects', status: 'denied' },
		{ projectId: 'proj-2', status: 'denied' }
	]);
	record('tells-listeners-a-refused-read-is-denied-before-it-rethrows', [
		{
			name: '401 denies the whole session',
			input: { projectId: 'proj-1' },
			error: summary(thrown401)
		},
		{
			name: '403 denies that one project',
			input: { projectId: 'proj-2' },
			error: summary(thrown403)
		}
	]);
});

test('Passes an agent rejection through unchanged', async () => {
	const agentError = new Error('Agent offline');
	const { bridge } = bridgeWith({
		'GET /api/projects/proj-1/snapshot': snapshotFor('proj-1', shownCaps, true),
		'POST /api/projects/proj-1/agent': agentError
	});
	const beforeShown = await rejection(() => bridge.providers());
	await bridge.selectProject({ projectId: 'proj-1' });
	const afterShown = await rejection(() => bridge.providers());
	expect(beforeShown).toBeInstanceOf(ProjectIdRequiredError);
	expect(afterShown).toBe(agentError);
	record('passes-an-agent-rejection-through-unchanged', [
		{
			name: 'agent call before any project is shown',
			input: { shown: false },
			error: summary(beforeShown)
		},
		{
			name: 'agent call after a project is shown',
			input: { shown: 'proj-1' },
			error: summary(afterShown)
		}
	]);
});
