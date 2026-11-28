import { expect } from '../../../test/verificationExpect';
import { afterEach, vi } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { PNG } from 'pngjs';
import { ProjectSessionService } from '../src/services/projects-sessions/project-session-service/ProjectSessionService';
import { DesktopRunService } from '../src/services/agents-providers/desktop-run-service/DesktopRunService';
import { ProviderDiscoveryService } from '../src/services/agents-providers/provider-discovery-service/ProviderDiscoveryService';
import type {
	AgentRunner,
	AgentTurn,
	ImageGenerator
} from '../src/models/agents-providers/AgentRunner.types';
import type { RenderMockups } from '../src/utils/planning-collaboration/mockupSource.types';
import type { RunEvent, RunRequest } from '../src/models/DesktopBridge.types';
import { createPlanning } from '../../planning/src/lib/planning/index';
const roots: string[] = [];
export const bytes = PNG.sync.write(new PNG({ width: 2, height: 2 }));
export const git = (root: string, ...args: string[]) =>
	execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
afterEach(async () => {
	await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});
export function visualAnswer(turn: AgentTurn, source = 'src/owned.ts') {
	if (turn.model !== 'claude-sonnet-5-5') return null;
	const count = Number(/Design option count: (\d+)/.exec(turn.prompt)?.[1] ?? '1');
	const options = Array.from({ length: count }, (_, index) => ({
		direction: 'Fixture option ' + (index + 1),
		html: `<main class="fixture-card">Fixture option ${index + 1}</main>`,
		css: '.fixture-card { background: var(--fixture-surface); padding: 1rem; }'
	}));
	return JSON.stringify({ sources: [source], stylesheets: [], before: null, options });
}

function fakeRunner(action: (turn: AgentTurn) => Promise<void>) {
	const run = vi.fn(async (turn: AgentTurn) => {
		await action(turn);
		return { text: visualAnswer(turn) ?? 'Precise design direction', model: turn.model };
	});
	const runner: AgentRunner = {
		run,
		discover: async () => ({
			id: 'codex',
			label: 'Fixture',
			available: true,
			reason: null,
			version: 'fixture',
			imageGeneration: false,
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
async function repository() {
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
	return root;
}

export async function fixture(action: (turn: AgentTurn) => Promise<void> = async () => {}) {
	const root = await repository();
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
	const renderMockups = vi.fn<RenderMockups>(async (captures) => captures.map(() => bytes));
	const service = new DesktopRunService(
		session,
		providers(runner),
		(event) => events.push(event),
		renderMockups
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
	return {
		root,
		session,
		planning,
		service,
		events,
		run,
		runner,
		generator,
		renderMockups,
		request
	};
}
export async function settled(
	f: Awaited<ReturnType<typeof fixture>>,
	request = f.request,
	timeout = 30000
) {
	const started = await f.service.start(request);
	await expect.poll(() => f.session.busy, { timeout }).toBe(false);
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
