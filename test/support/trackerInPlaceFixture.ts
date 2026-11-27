import { mkdirSync, readdirSync, readFileSync, realpathSync } from 'node:fs';
import { expect } from 'vitest';
import { join } from 'node:path';
import { trackerManagedHostLauncher } from '../../src/adapters/projects-sessions/tracker-tmux-adapter/trackerManagedHostLauncher';
import type { TrackerRunReceipt } from '../../src/services/agents-providers/TrackerDispatcherService.types';
import type { TrackerHostStartRequest } from '../../src/services/projects-sessions/tracker-native-runtime-service/trackerHostLaunch.types';
import { managedFixtureBindings } from './trackerManagedProcessFixture';

const node = 'daniel-primary-mbp';
const itemId = 'abc123def4';

/** A managed launcher over fixture programs, with a project directory that may not use git. */
export function inPlaceLaunch(root: string, options: { git?: string } = {}) {
	const { config } = managedFixtureBindings(root);
	const source = options.git ?? join(root, 'plain-project');
	mkdirSync(source, { recursive: true });
	const launcher = trackerManagedHostLauncher(config, {
		client: { node, role: 'hub', apiPort: 49281, syncPort: 49282, writeGuestAuth: () => {} },
		platform: 'darwin'
	});
	const input = {
		node,
		runId: 1,
		itemId,
		backend: 'native' as const,
		repo: source,
		platform: 'macos' as const,
		brief: '# Fixture\n## Completion and worktree cleanup\nFirst run tracker done.',
		key: JSON.stringify([itemId, 'reserved-fixture', 1]),
		queuedAt: Date.now() - 1000,
		selection: { provider: 'codex' as const, model: 'gpt-6.2-sol', intelligence: 'high' }
	} satisfies TrackerHostStartRequest;
	const state = () => join(config.stateDirectory, readdirSync(config.stateDirectory)[0]);
	return { launcher, input, source, state };
}

export function inPlaceRun({ runId }: TrackerHostStartRequest) {
	return {
		node,
		id: runId,
		item_id: itemId,
		auto_token: 'reserved-fixture',
		attempt: 1
	} as unknown as TrackerRunReceipt;
}

export function verifyInPlaceBrief(
	config: ReturnType<typeof managedFixtureBindings>['config'],
	ops: string
) {
	const invocation = JSON.parse(
		readFileSync(join(config.native.profile, 'invoked.ndjson'), 'utf8')
	);
	expect(invocation.cwd).toBe(realpathSync(ops));
	const [attempt] = readdirSync(config.stateDirectory);
	const brief = readFileSync(join(config.stateDirectory, attempt, 'brief.md'), 'utf8');
	expect(brief).toContain('in place');
	expect(brief).toContain(invocation.cwd);
	expect(brief).not.toContain('private git worktree');
}
