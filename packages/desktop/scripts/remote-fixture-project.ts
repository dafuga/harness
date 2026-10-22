import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, realpath, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PNG } from 'pngjs';
import { RunCancelled } from '../src/models/agents-providers/AgentRunner.types';
import type {
	AgentRunner,
	AgentTurn,
	ImageGenerator
} from '../src/models/agents-providers/AgentRunner.types';
import type { ProviderId, ProviderState } from '../src/models/development-tooling/Desktop.types';
import { ProjectSessionService } from '../src/services/projects-sessions/project-session-service/ProjectSessionService';

const model = 'fixture-model';
const git = (root: string, ...args: string[]) =>
	execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
/**
 * A picture with a visible gradient, so a cached copy is recognisable on a screen. A `variant`
 * other than 0 shifts its blue, so each generated picture differs; 0 is the picture it always was.
 */
export function fixtureImage(size = 96, variant = 0): Uint8Array {
	const png = new PNG({ width: size, height: size });
	for (let index = 0; index < size * size; index++) {
		const x = index % size,
			y = Math.floor(index / size);
		png.data.set([(x * 255) / size, (y * 255) / size, 160 + 9 * variant, 255], index * 4);
	}
	return PNG.sync.write(png);
}
/** TEST ONLY. A disposable Git repository with one planned page, a thread and a design image. */
export async function remoteFixtureProject() {
	const root = await realpath(await mkdtemp(join(tmpdir(), 'harness-remote-fixture-')));
	git(root, 'init', '-b', 'main');
	git(root, 'config', 'user.name', 'Harness Remote Fixture');
	git(root, 'config', 'user.email', 'fixture@example.invalid');
	git(root, 'config', 'commit.gpgsign', 'false');
	git(root, 'lfs', 'install', '--local');
	await mkdir(join(root, 'src'));
	await writeFile(join(root, 'src/fixture.ts'), 'export const synthetic = true;\n');
	git(root, 'add', '.');
	git(root, 'commit', '-m', 'chore: seed synthetic remote fixture');
	const session = new ProjectSessionService();
	await session.open(root);
	const { planning } = session.requireProject(),
		goal = 'A synthetic page for pairing a simulator with a disposable computer.';
	const plan = await planning.createPlan({ category: 'pages', title: 'Fixture page', goal });
	const anchor = { version: null, imageSha256: null, state: null, viewport: null, region: null },
		thread = await planning.openThread({ entityId: plan.id, ...anchor });
	await planning.addDesign({
		entityId: plan.id,
		prompt: 'Synthetic fixture design, made by no agent.',
		generator: { provider: 'codex', model },
		baseRevision: git(root, 'rev-parse', 'HEAD'),
		state: 'default',
		viewport: 'desktop',
		bytes: fixtureImage()
	});
	return { root, entityId: plan.id, threadId: thread.id };
}
function discovered(id: ProviderId): ProviderState {
	const choice = { id: model, label: 'Fixture model', efforts: ['high'], defaultEffort: 'high' };
	return {
		id,
		label: 'Fixture CLI (synthetic, runs nothing)',
		available: true,
		reason: null,
		version: 'fixture',
		imageGeneration: id === 'codex',
		models: [{ ...choice, isDefault: true }]
	};
}
/** A turn that takes a moment, so that a phone sees progress, and that honours a cancel. */
async function syntheticTurn(turn: AgentTurn) {
	turn.onStatus('Synthetic run of the remote fixture');
	turn.onText('This answer comes from the fixture, not from a coding agent.');
	await new Promise((resolve) => setTimeout(resolve, 1200));
	if (turn.signal.aborted) throw new RunCancelled();
	const request = turn.prompt.split('\nRequest:\n').at(-1)?.slice(0, 600) ?? '';
	return {
		text: `# Synthetic fixture proposal
## Overview
Synthetic design direction from the remote stand-in fixture; no coding agent runs here.
Requested: ${request}
## Acceptance Criteria
- Display the synthetic fixture design and preserve its review state.
## Dependencies
Use only the existing synthetic image generator and project fixture.
## Verification
Run the remote fixture integration and browser checks for transport and rendering.
## Performance
Use a representative fixture workload; plan latency and process memory measurements through Harness during coding.
`,
		model: turn.model
	};
}
/** TEST ONLY. Stands in for the installed CLIs: it starts no process and changes no file. */
export function fixtureProviders(): Record<ProviderId, AgentRunner> & {
	generator: ImageGenerator;
} {
	const runner = (id: ProviderId): AgentRunner => ({
		discover: async () => discovered(id),
		run: syntheticTurn
	});
	// Each generation is a picture of its own, the first the one it always was.
	let made = 0;
	const generator: ImageGenerator = {
		generateImage: async () => ({ bytes: fixtureImage(128, made++), revisedPrompt: null })
	};
	return { codex: runner('codex'), claude: runner('claude'), generator };
}
