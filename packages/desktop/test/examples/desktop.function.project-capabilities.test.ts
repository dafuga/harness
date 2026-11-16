import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { projectCapabilities } from '../../src/utils/projects-sessions/load-workspace/projectCapabilities';
import { closedCapabilities } from '../../src/utils/projects-sessions/projectCapabilities';
import type { ProjectSnapshot } from '../../src/models/development-tooling/Desktop.types';

const snapshot = (id?: string, capabilities?: typeof closedCapabilities) => ({
	project: { name: 'example-project', root: '/workspace/project', kind: 'local', ...(id ? { id } : {}) },
	...(capabilities ? { capabilities } : {}),
	revision: { branch: 'main', commit: 'abc123', tip: 'abc123', atTip: true },
	branches: [],
	commits: [],
	entities: [],
	writable: true
}) as unknown as ProjectSnapshot;

const bridge = (extra: Record<string, unknown> = {}) => extra as unknown as Parameters<typeof projectCapabilities>[0];

const summary = (value: Awaited<ReturnType<typeof projectCapabilities>>) => ({
	comments: value.comments,
	agents: value.agents,
	planning: value.planning,
	approval: value.approval,
	source: value.source,
	reason: value.reason
});

test('selects project capabilities with safe fallbacks', async () => {
	const reported = { ...closedCapabilities, comments: true, agents: true, source: 'github' as const };
	const calls: unknown[] = [];
	const fromSnapshot = await projectCapabilities(bridge({ addComment() {} }), snapshot('repo-1', reported));
	const fromReader = await projectCapabilities(bridge({
		capabilities: async (input: unknown) => { calls.push(input); return reported; },
		addComment() {}
	}), snapshot('repo-2'));
	const legacy = await projectCapabilities(bridge(), snapshot());
	const rejected = await projectCapabilities(bridge({ capabilities: async () => { throw new Error('offline'); } }), snapshot());

	expect(summary(fromSnapshot)).toEqual({ comments: true, agents: true, planning: false, approval: false, source: 'github', reason: undefined });
	expect(calls).toEqual([{ projectId: 'repo-2' }]);
	expect(summary(fromReader).comments).toBe(true);
	expect(summary(legacy)).toMatchObject({ comments: false, agents: true, planning: true, approval: true, source: 'local' });
	expect(summary(rejected)).toMatchObject({ comments: false, agents: false, planning: false, approval: false, source: 'local', reason: 'This project did not report what it allows.' });

	recordExampleCases(
		{
			unitId: 'desktop.function.project-capabilities',
			symbol: 'projectCapabilities',
			state: 'selects-project-capabilities-with-safe-fallbacks',
			evidence: 'examples-cases',
			file: 'selects-project-capabilities-with-safe-fallbacks.json'
		},
		[
			{ name: 'snapshot capabilities take precedence and comments need an operation', input: { snapshot: 'reported capabilities', bridge: 'comment operation available' }, output: summary(fromSnapshot) },
			{ name: 'reader receives truthy project id', input: { snapshot: 'missing capabilities with repo-2 id', bridge: 'reader and comment operation' }, output: { capabilities: summary(fromReader), readerCalls: calls } },
			{ name: 'legacy bridge receives safe agent defaults', input: { snapshot: 'missing capabilities', bridge: 'no capability reader' }, output: summary(legacy) },
			{ name: 'reader rejection closes capabilities with reason', input: { snapshot: 'missing capabilities', bridge: 'reader rejects' }, output: summary(rejected) }
		]
	);
});
