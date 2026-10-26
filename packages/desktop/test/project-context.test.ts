import { desktopBridge } from '../src/lib/development-tooling/desktop-bridge/desktopBridge';
import { AgentActivityService } from '../../../src/services/agent-activity-service/AgentActivityService';
import { ProjectWorkRepository } from '../../../src/repositories/ProjectWorkRepository';
import { test, expect, vi } from 'vitest';
import { FeatureWorkService } from '../../../src/services/agents-providers/FeatureWorkService';
import { fixture } from './project-fixture';
test('an explicit stale project ID cannot read the newly selected project', async () => {
	const a = await fixture(),
		b = await fixture();
	const first = await a.session.snapshot({ branch: null, commit: null });
	expect(first.project.id).toBeTypeOf('string');
	await a.session.open(b.root);
	await expect(
		a.session.snapshot({ projectId: first.project.id, branch: null, commit: null })
	).rejects.toThrow('project');
}, 15000);

test('live agent reads follow the selected repository and reject a stale project identity', async () => {
	const first = await fixture(),
		other = await fixture();
	const checkouts = await new ProjectWorkRepository(first.root).checkouts();
	const registry = new AgentActivityService(first.root, checkouts);
	await registry.register({
		label: 'Component session',
		task: 'Review a component',
		units: 'reports.component.select'
	});
	const bridge = desktopBridge({
		session: first.session,
		providers: {} as never,
		runs: {} as never,
		choose: async () => null
	});
	const id = first.session.projectId!;
	const live = await bridge.agentActivity!({ projectId: id });
	expect(live.agents.working).toBe(1);
	expect(live.agents.roster[0]).toMatchObject({
		label: 'Component session',
		task: 'Review a component'
	});
	await expect(bridge.agentActivity!({ projectId: other.session.projectId! })).rejects.toThrow(
		'not selected'
	);
	await first.session.open(other.root);
	await expect(bridge.agentActivity!({ projectId: id })).rejects.toThrow('not selected');
	const empty = await bridge.agentActivity!({ projectId: first.session.projectId! });
	expect(empty.agents).toMatchObject({ tracking: 'never-used', working: null, roster: [] });
}, 15000);

const workSnapshot = {
	queueCommit: 'a'.repeat(40),
	features: [
		{
			id: 'checkout',
			goal: 'Review checkout',
			tldr: 'Build checkout',
			plan: null,
			tasks: [
				{
					id: 'checkout.build',
					title: 'Build',
					module: 'service.checkout',
					status: 'queued' as const,
					dependsOn: [],
					blockedBy: [],
					belongsToPlan: false
				}
			]
		}
	]
};

function workBridge(session: Awaited<ReturnType<typeof fixture>>['session']) {
	return desktopBridge({
		session,
		providers: {} as never,
		runs: {} as never,
		choose: async () => null
	}) as unknown as {
		projectWork: (input: { projectId: string }) => Promise<typeof workSnapshot>;
	};
}

test('project Work returns one committed snapshot and rejects a foreign project before reading', async () => {
	const selected = await fixture(),
		foreign = await fixture();
	const bridge = workBridge(selected.session);
	const read = vi.spyOn(FeatureWorkService.prototype, 'read').mockResolvedValue(workSnapshot);
	try {
		expect(bridge.projectWork).toBeTypeOf('function');
		await expect(bridge.projectWork({ projectId: foreign.session.projectId! })).rejects.toThrow(
			'project'
		);
		expect(read).not.toHaveBeenCalled();
		const snapshot = await bridge.projectWork({ projectId: selected.session.projectId! });
		expect(snapshot).toEqual(workSnapshot);
		expect(read).toHaveBeenCalledTimes(1);
		expect(JSON.stringify(snapshot)).not.toContain(selected.root);
		expect(JSON.stringify(snapshot)).not.toMatch(
			/"(?:claim|claimHistory|executions|worktree|output)":/
		);
	} finally {
		read.mockRestore();
	}
}, 30000);

test('project Work rejects a completed read after selection changes', async () => {
	const selected = await fixture(),
		foreign = await fixture();
	const bridge = workBridge(selected.session);
	let release!: (value: typeof workSnapshot) => void;
	const deferred = new Promise<typeof workSnapshot>((resolve) => {
		release = resolve;
	});
	const read = vi.spyOn(FeatureWorkService.prototype, 'read').mockReturnValue(deferred);
	const projectId = selected.session.projectId!;
	let pending: Promise<typeof workSnapshot> | undefined;
	try {
		expect(bridge.projectWork).toBeTypeOf('function');
		pending = bridge.projectWork({ projectId });
		void pending.catch(() => undefined);
		await vi.waitFor(() => expect(read).toHaveBeenCalledTimes(1));
		await expect(selected.session.open(foreign.root)).rejects.toThrow();
		expect(selected.session.projectId).toBe(projectId);
		release(workSnapshot);
		await expect(pending).resolves.toEqual(workSnapshot);
		await selected.session.open(foreign.root);
		expect(selected.session.projectId).not.toBe(projectId);
		await expect(bridge.projectWork({ projectId })).rejects.toThrow('project');
		expect(read).toHaveBeenCalledTimes(1);
	} finally {
		release(workSnapshot);
		await pending?.catch(() => undefined);
		read.mockRestore();
	}
}, 30000);
