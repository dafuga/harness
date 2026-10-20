import { expect } from '../../../test/verificationExpect';
import { afterEach, vi } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { PNG } from 'pngjs';
import { ProjectSessionService } from '../src/services/ProjectSessionService';
import { DesktopRunService } from '../src/services/desktop-run-service/DesktopRunService';
import { ProviderDiscoveryService } from '../src/services/provider-discovery-service/ProviderDiscoveryService';
import type { AgentRunner, AgentTurn, ImageGenerator } from '../src/models/AgentRunner.types';
import type { RunEvent, RunRequest } from '../src/models/DesktopBridge.types';
import { createPlanning } from '../../planning/src/lib/planning/index';
const roots: string[] = [];
export const proposal = `# Target proposal
## Overview
Precise design direction for the requested target and its contract.
## Acceptance Criteria
- The target renders its approved state and preserves the stated behavior.
## Dependencies
Use the existing project components and the approved target contract.
## Verification
Run the target unit tests and browser state checks before accepting implementation.
## Performance
Profile representative target rendering workloads for latency and memory through Harness during implementation.
`;
export const bytes = PNG.sync.write(new PNG({ width: 2, height: 2 }));
export const git = (root: string, ...args: string[]) =>
	execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
afterEach(async () => {
	await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});
function fakeRunner(action: (turn: AgentTurn) => Promise<void>) {
	const run = vi.fn(async (turn: AgentTurn) => {
		await action(turn);
		return { text: proposal, model: turn.model };
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
	await expect.poll(() => f.session.busy, { timeout: 12000 }).toBe(false);
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
