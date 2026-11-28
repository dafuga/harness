import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { expect, vi } from 'vitest';
import { TrackerNativeRuntimeService } from '../../src/services/projects-sessions/TrackerNativeRuntimeService';
import { trackerNodeRuntime } from '../../src/services/projects-sessions/tracker-node-service/trackerNodeRuntime';
import type {
	TrackerHostLaunchPort,
	TrackerHostStartRequest
} from '../../src/services/projects-sessions/tracker-native-runtime-service/trackerHostLaunch.types';
import { withTempRepo } from './temporary';
import type { TemporaryRepo } from './temporary.types';
import { onIdleHost } from './trackerHostResourceFixture';
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

/** A launch that cannot create its checkout says why. */
export async function verifyUnusableWorktree(
	launcher: TrackerHostLaunchPort,
	native: TrackerHostStartRequest
) {
	await withTempRepo(async ({ root }) => {
		// An initialized repository without a commit cannot create a detached checkout.
		const unusable = { ...native, runId: 5, key: 'unusable', repo: root };
		expect(await launcher.start(unusable, new AbortController().signal)).toEqual({
			status: 'rejected',
			detail: expect.stringMatching(/could not create a worktree of .*HEAD/s)
		});
	});
}

const startupCauses = {
	'signed-out': /sign in/i,
	'locked-keychain': /sign in/i,
	onboarding: /onboarding/i,
	untrusted: /trust this project folder/i,
	crash: /synthetic launcher crash/i
};

export async function verifyClaudeStartupRejection(
	repo: TemporaryRepo,
	mode: keyof typeof startupCauses
) {
	await withClaudeLaunch(repo, mode, async ({ root, database, tick }) => {
		await tick();
		expect(
			database.prepare('SELECT state,started_at FROM runs ORDER BY id').all()
		).not.toContainEqual({ state: 'running', started_at: expect.any(Number) });
		await tick();
		expect(
			database.prepare('SELECT status,needs_daniel,blocked_reason,question FROM items').get()
		).toMatchObject({
			status: 'blocked',
			needs_daniel: 1,
			blocked_reason: expect.stringMatching(startupCauses[mode]),
			question: expect.stringMatching(/^Blocked: auto-launch gave up/)
		});
		expect(
			database.prepare("SELECT text FROM item_notes WHERE text LIKE 'blocked: %'").all()
		).toHaveLength(1);
		expect(readdirSync(root).filter((file) => file.startsWith('claude-pane-'))).toEqual([]);
		expect(readdirSync(root)).not.toContain('trust-keys');
	});
}

/** The trust dialog is confirmed once, and only for a checkout of one of Daniel's repositories. */
export async function verifyOwnedWorktreeTrust(repo: TemporaryRepo) {
	repo.git('remote', 'add', 'origin', 'https://github.com/dafuga/fixture.git');
	await withClaudeLaunch(repo, 'untrusted', async ({ root, database, tick }) => {
		await tick();
		await tick();
		expect(readFileSync(join(root, 'trust-keys'), 'utf8').trim().split('\n')).toEqual([
			expect.stringMatching(/send-keys -t \S+ Down Enter$/)
		]);
		expect(database.prepare('SELECT state,outcome FROM runs').all()).toEqual([
			{ state: 'running', outcome: null }
		]);
	});
}

export async function verifyClaudeLinkage(repo: TemporaryRepo) {
	await withClaudeLaunch(repo, 'ready', async ({ root, database, runtime, tick }) => {
		await tick();
		const name = 'Harness: Synthetic Claude launch  tmux format';
		expect(readFileSync(join(root, 'window-names'), 'utf8').trim()).toBe(name);
		expect((await managedTrackerItemRequest(runtime, claudeItem, 'done')).ok).toBe(true);
		await tick();
		const run = database.prepare('SELECT * FROM runs').get()!;
		expect(run).toMatchObject({
			state: 'finished',
			outcome: 'done',
			session_name: name,
			input_tokens: 200,
			output_tokens: 50,
			cache_read_tokens: 2000,
			cache_write_tokens: 1000
		});
		// Sonnet's flat Tracker rates: $2 in, $10 out, $0.10 cache read, $4 cache write per MTok.
		expect(run.cost_usd).toBeCloseTo((200 * 2 + 50 * 10 + 2000 * 0.1 + 1000 * 4) / 1e6, 10);
		const launched = JSON.parse(
			readFileSync(join(root, 'account-home', 'invoked.ndjson'), 'utf8').trim()
		);
		const flag = (flagName: string) => launched.argv[launched.argv.indexOf(flagName) + 1];
		expect(flag('--remote-control')).toBe(name);
		expect(flag('--session-id')).toMatch(
			/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-8[a-f0-9]{3}-[a-f0-9]{12}$/
		);
		expect(JSON.parse(flag('--settings'))).toEqual({
			availableModels: ['opus', 'sonnet', 'haiku']
		});
	});
}

/** A tmux refusal is remembered until the reservation expires, instead of being swallowed. */
export async function verifyStartErrorCause(repo: TemporaryRepo) {
	writeFileSync(join(repo.root, 'tmux-refuses'), '');
	await withClaudeLaunch(repo, 'ready', async ({ database, tick }) => {
		await tick();
		const reason = () => database.prepare('SELECT failure_reason FROM runs WHERE id = 1').get();
		const cause = { failure_reason: expect.stringContaining('synthetic refusal') };
		expect(reason()).toEqual(cause);
		vi.setSystemTime(Date.now() + 6 * 60_000);
		await tick();
		expect(reason()).toEqual({
			failure_reason: expect.stringMatching(/expired before startup: .*synthetic refusal/)
		});
	});
}

const claudeItem = 'claude0001';

async function withClaudeLaunch(
	{ root, git }: TemporaryRepo,
	mode: keyof typeof startupCauses | 'ready',
	prove: (context: {
		root: string;
		database: DatabaseSync;
		runtime: TrackerNativeRuntimeService;
		tick: () => Promise<unknown>;
	}) => Promise<void>
) {
	git('commit', '--allow-empty', '-m', 'Fixture source');
	const { config, profiles } = managedFixtureBindings(root);
	writeFileSync(join(profiles.accountHome, '.claude-session-fixture'), mode);
	const database = new DatabaseSync(':memory:');
	vi.stubEnv('HOME', profiles.accountHome);
	// Automatic retries run through the night: the clock is fixed at 02:00 in Lisbon.
	vi.useFakeTimers({ toFake: ['Date'], now: Date.UTC(2026, 10, 26, 2), shouldAdvanceTime: true });
	try {
		const runtime = new TrackerNativeRuntimeService(
			database,
			onIdleHost(trackerNodeRuntime(managedForegroundConfig(root, config, 'macos')))
		);
		runtime.store.appendLocal({
			itemId: claudeItem,
			fields: {
				title:
					mode === 'ready' ? 'Synthetic Claude launch #( tmux format' : 'Synthetic Claude launch',
				status: 'open',
				kind: 'task',
				project: 'Harness',
				model: 'claude-sonnet-5-5:high'
			}
		});
		expect((await managedTrackerItemRequest(runtime, claudeItem, 'launch')).ok).toBe(true);
		const tick = () => runtime.scheduler!.tick(new AbortController().signal);
		await prove({ root, database, runtime, tick });
	} finally {
		vi.useRealTimers();
		vi.unstubAllEnvs();
		database.close();
	}
}
