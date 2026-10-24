import { desktopBridge } from '../src/lib/development-tooling/desktop-bridge/desktopBridge';
import { AgentActivityService } from '../../../src/services/agent-activity-service/AgentActivityService';
import { ProjectWorkRepository } from '../../../src/repositories/ProjectWorkRepository';
import { test, expect } from 'vitest';
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
