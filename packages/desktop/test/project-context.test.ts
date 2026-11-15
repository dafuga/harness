import { desktopBridge } from '../src/lib/development-tooling/desktop-bridge/desktopBridge';
import { AgentActivityService } from '../../../src/services/agents-providers/agent-activity-service/AgentActivityService';
import { ProjectWorkRepository } from '../../../src/repositories/projects-sessions/ProjectWorkRepository';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
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

test('relocated repositories leave no stub at their old paths or in the legacy manifest', () => {
	const root = resolve(import.meta.dirname, '../../..');
	const manifest: { legacy: string[] } = JSON.parse(
		readFileSync(join(root, 'harness.groups.json'), 'utf8')
	);
	const relocations: Record<string, string> = {
		MeasurementRepository: 'verification-evidence',
		ProjectWorkRepository: 'projects-sessions',
		ProviderSwitchRepository: 'agents-providers',
		ScenarioRepository: 'verification-evidence'
	};
	for (const [name, folder] of Object.entries(relocations)) {
		const stub = `src/repositories/${name}.ts`;
		const declaration = `src/repositories/${folder}/${name}.ts`;
		expect(existsSync(join(root, stub)), stub).toBe(false);
		expect(existsSync(join(root, declaration)), declaration).toBe(true);
		expect(manifest.legacy, stub).not.toContain(stub);
	}
});
