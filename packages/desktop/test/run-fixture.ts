import type { localFixture } from './local-transport-fixture';
import { FeaturePlanService } from '../../../src/services/agents-providers/FeaturePlanService';
import { FeaturePlanRepository } from '../../../src/repositories/agents-providers/FeaturePlanRepository';
import { ModuleTaskServerService } from '../../../src/services/agents-providers/ModuleTaskServerService';
import type { FeaturePlan } from '../../../src/repositories/agents-providers/ModuleTaskRepository.types';
import { fixtureGit as git, seedOwnedFixture } from '../scripts/committed-fixture';
import { expect } from '../../../test/verificationExpect';
import { afterEach, vi } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PNG } from 'pngjs';
import { ProjectSessionService } from '../src/services/ProjectSessionService';
import { DesktopRunService } from '../src/services/desktop-run-service/DesktopRunService';
import { ProviderDiscoveryService } from '../src/services/provider-discovery-service/ProviderDiscoveryService';
import type { AgentRunner, AgentTurn, ImageGenerator } from '../src/models/AgentRunner.types';
import type { RunEvent, RunRequest } from '../src/models/DesktopBridge.types';
import { createPlanning } from '../../planning/src/lib/planning/index';
const roots: string[] = [];
export const bytes = PNG.sync.write(new PNG({ width: 2, height: 2 }));
export { git };
afterEach(async () => {
	await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});
function fakeRunner(action: (turn: AgentTurn) => Promise<void>) {
	const run = vi.fn(async (turn: AgentTurn) => {
		await action(turn);
		return { text: 'Precise design direction', model: turn.model };
	});
	const runner: AgentRunner = {
		run,
		discover: async () => ({
			id: 'codex',
			label: 'Fixture',
			available: true,
			reason: null,
			version: 'fixture',
			imageGeneration: true,
			models: [
				{
					id: 'selected',
					label: 'Selected',
					efforts: ['high'],
					defaultEffort: 'high',
					isDefault: true
				}
			]
		})
	};
	return { run, runner };
}
function providers(runner: AgentRunner) {
	return new ProviderDiscoveryService({
		codex: runner,
		claude: {
			run: runner.run,
			discover: async () => ({
				...(await runner.discover()),
				id: 'claude',
				imageGeneration: false
			})
		}
	});
}
export async function fixture(action: (turn: AgentTurn) => Promise<void> = async () => {}) {
	const root = await realpath(await mkdtemp(join(tmpdir(), 'harness-run-')));
	roots.push(root);
	git(root, 'init', '-b', 'main');
	git(root, 'config', 'user.name', 'Fixture');
	git(root, 'config', 'user.email', 'fixture@example.invalid');
	git(root, 'lfs', 'install', '--local');
	await mkdir(join(root, 'src'));
	await writeFile(join(root, 'src/owned.ts'), 'committed source');
	seedOwnedFixture(root);
	git(root, 'add', '.');
	git(root, 'commit', '-m', 'initial');
	const session = new ProjectSessionService();
	await session.open(root);
	const { planning } = session.requireProject();
	const plan = await planning.createPlan({
		category: 'pages',
		title: 'Target',
		goal: 'Test target'
	});
	const thread = await planning.openThread({
		entityId: plan.id,
		version: null,
		imageSha256: null,
		state: null,
		viewport: null,
		region: null
	});
	const { run, runner } = fakeRunner(action);
	const generator: ImageGenerator = {
		generateImage: vi.fn(async () => ({ bytes, revisedPrompt: null }))
	};
	const events: RunEvent[] = [];
	const service = new DesktopRunService(session, providers(runner), generator, (event) =>
		events.push(event)
	);
	const request: RunRequest = {
		mode: 'plan',
		provider: 'codex',
		model: 'selected',
		effort: 'high',
		entityId: plan.id,
		threadId: thread.id,
		text: 'Design target',
		approval: null
	};
	return { root, session, planning, service, events, run, runner, generator, request };
}
export async function settled(f: Awaited<ReturnType<typeof fixture>>, request = f.request) {
	const started = await f.service.start(request);
	await expect.poll(() => f.session.busy, { timeout: 30000 }).toBe(false);
	return started;
}
export async function approve(f: Awaited<ReturnType<typeof fixture>>) {
	const revision = git(f.root, 'rev-parse', 'HEAD');
	const design = await f.planning.addDesign({
		entityId: f.request.entityId,
		prompt: 'Approved design',
		generator: { provider: 'codex', model: 'selected' },
		baseRevision: revision,
		state: 'default',
		viewport: 'desktop',
		bytes
	});
	const plan = (await f.planning.plans(git(f.root, 'rev-parse', 'HEAD')))[0];
	const approval = {
		version: design.version,
		imageHashes: design.images.map((i) => i.sha256),
		contractHash: plan.contract.hash!
	};
	await f.planning.approve({ entityId: plan.id, ...approval });
	return { ...f.request, mode: 'change' as const, approval };
}
export async function records(f: Awaited<ReturnType<typeof fixture>>) {
	const plan = await (await createPlanning(f.root)).readPlan({ unitId: f.request.entityId });
	return plan.threads[0].messages.filter((m) => m.change).map((m) => m.change!);
}

/** A local plan action carries its selected project and exact digest to trusted services. */
function featureActionMocks(f: Awaited<ReturnType<typeof localFixture>>) {
	const digest = 'a'.repeat(64),
		selected = {
			feature: 'feature',
			digest,
			sourceCommit: git(f.root, 'rev-parse', 'HEAD'),
			revision: 2,
			goal: 'Goal',
			tldr: 'Summary',
			pages: [],
			changes: [],
			tasks: []
		} satisfies FeaturePlan,
		approved = {
			...selected,
			approval: { digest, reviewer: 'Daniel', approvedAt: '2026-10-27T00:00:00.000Z' }
		};
	const select = vi.spyOn(FeaturePlanService.prototype, 'select').mockResolvedValue(selected);
	const read = vi
		.spyOn(FeaturePlanRepository.prototype, 'read')
		.mockResolvedValue({ commit: undefined, plans: [selected] });
	const approve = vi.spyOn(FeaturePlanService.prototype, 'approve').mockResolvedValue(approved);
	const submit = vi
		.spyOn(ModuleTaskServerService.prototype, 'submitApproved')
		.mockResolvedValue({ created: ['feature.task'], reused: [], commit: undefined });
	const selection = {
			projectId: f.project.id,
			feature: 'feature',
			page: 'page',
			option: 'o1',
			expectedDigest: digest
		},
		approval = {
			projectId: f.project.id,
			feature: 'feature',
			reviewer: 'Daniel',
			expectedDigest: digest
		};
	return { digest, selected, approved, select, read, approve, submit, selection, approval };
}

export async function featureActions(
	f: Awaited<ReturnType<typeof localFixture>>,
	client: ReturnType<typeof f.connect>
) {
	const { digest, selected, approved, select, read, approve, submit, selection, approval } =
		featureActionMocks(f);
	expect(await client.request('selectFeaturePlan' as never, selection)).toEqual(selected);
	const { projectId, ...expectedSelection } = selection;
	expect(projectId).toBe(f.project.id);
	expect(select).toHaveBeenCalledWith(expectedSelection);
	await expect(
		client.request('selectFeaturePlan' as never, { ...selection, expectedDigest: 'b'.repeat(64) })
	).rejects.toThrow();
	await expect(
		client.request('selectFeaturePlan' as never, { ...selection, projectId: 'another-project' })
	).rejects.toThrow();
	read.mockResolvedValueOnce({
		commit: undefined,
		plans: [{ ...selected, sourceCommit: 'f'.repeat(40) }]
	});
	await expect(client.request('selectFeaturePlan' as never, selection)).rejects.toThrow();
	await expect(
		client.request('approveFeaturePlan' as never, { ...approval, expectedDigest: 'bad' })
	).rejects.toThrow();
	expect(approve).not.toHaveBeenCalled();
	expect(await client.request('approveFeaturePlan' as never, approval)).toEqual(approved);
	expect(approve).toHaveBeenCalledWith({
		feature: 'feature',
		reviewer: 'Daniel',
		expectedDigest: digest
	});
	expect(submit).toHaveBeenCalledWith({ feature: 'feature', expectedDigest: digest });
	expect(f.run).not.toHaveBeenCalled();
}
