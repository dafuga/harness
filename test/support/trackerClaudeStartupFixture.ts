import { readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { expect, vi } from 'vitest';
import { TrackerNativeRuntimeService } from '../../src/services/projects-sessions/TrackerNativeRuntimeService';
import { trackerNodeRuntime } from '../../src/services/projects-sessions/tracker-node-service/trackerNodeRuntime';
import type {
	TrackerHostLaunchPort,
	TrackerHostStartRequest
} from '../../src/services/projects-sessions/tracker-native-runtime-service/trackerHostLaunch.types';
import type { TemporaryRepo } from './temporary.types';
import {
	managedFixtureBindings,
	managedForegroundConfig,
	managedTrackerItemRequest
} from './trackerManagedProcessFixture';

export async function verifyClaudeRefusals(
	launcher: TrackerHostLaunchPort,
	claude: TrackerHostStartRequest,
	accountHome: string
) {
	const signal = new AbortController().signal;
	const state = join(accountHome, '.claude-session-fixture');
	for (const [mode, reason] of [
		['signed-out', 'claude-sign-in'],
		['onboarding', 'claude-onboarding'],
		['unverified', 'claude-auth-unverified']
	]) {
		writeFileSync(state, mode);
		const input = { ...claude, runId: 4, key: JSON.stringify([claude.itemId, mode, 1]) };
		expect(await launcher.start(input, signal)).toEqual({ status: 'rejected', reason });
	}
}

export async function verifyClaudeStartupRejection(
	{ root, git }: TemporaryRepo,
	mode: 'signed-out' | 'onboarding'
) {
	git('commit', '--allow-empty', '-m', 'Fixture source');
	const { config, profiles } = managedFixtureBindings(root);
	writeFileSync(join(profiles.accountHome, '.claude-session-fixture'), mode);
	const database = new DatabaseSync(':memory:');
	const id = 'claude0001';
	vi.stubEnv('HOME', profiles.accountHome);
	try {
		const runtime = new TrackerNativeRuntimeService(
			database,
			trackerNodeRuntime(managedForegroundConfig(root, config, 'macos'))
		);
		runtime.store.appendLocal({
			itemId: id,
			fields: {
				title: 'Synthetic Claude launch',
				status: 'open',
				kind: 'task',
				project: 'Harness',
				model: 'claude-sonnet-5-5:high'
			}
		});
		expect((await managedTrackerItemRequest(runtime, id, 'launch')).ok).toBe(true);
		const tick = () => runtime.scheduler!.tick(new AbortController().signal);
		await tick();
		expect(
			database.prepare('SELECT state,started_at FROM runs ORDER BY id').all()
		).not.toContainEqual({ state: 'running', started_at: expect.any(Number) });
		await tick();
		const cause = mode === 'signed-out' ? /sign in/i : /onboarding/i;
		expect(
			database.prepare('SELECT status,needs_daniel,blocked_reason FROM items WHERE id = ?').get(id)
		).toMatchObject({
			status: 'blocked',
			needs_daniel: 1,
			blocked_reason: expect.stringMatching(cause)
		});
		expect(readdirSync(root).filter((file) => file.startsWith('claude-pane-'))).toEqual([]);
	} finally {
		vi.unstubAllEnvs();
		database.close();
	}
}
