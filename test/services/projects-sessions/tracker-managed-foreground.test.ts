import {
	existsSync,
	mkdirSync,
	readFileSync,
	readdirSync,
	unlinkSync,
	writeFileSync
} from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { expect, test } from 'vitest';
import { TrackerNativeRuntimeService } from '../../../src/services/projects-sessions/TrackerNativeRuntimeService';
import { trackerNodeRuntime } from '../../../src/services/projects-sessions/tracker-node-service/trackerNodeRuntime';
import { withTempRepo } from '../../support/temporary';
import type { TemporaryRepo } from '../../support/temporary.types';
import { measureWorkload } from '../../support/measureWorkload';
import { onIdleHost } from '../../support/trackerHostResourceFixture';
import {
	managedFixtureBindings,
	managedForegroundConfig,
	managedTrackerItemRequest,
	seedManagedBriefItems
} from '../../support/trackerManagedProcessFixture';
import {
	verifyCancelledClaim,
	verifyExpiredClaim,
	verifyLegacyQueuedClaim,
	verifyManagedBrief
} from '../../support/trackerManagedLaunchAssertions';

import { verifyInPlaceBrief } from '../../support/trackerInPlaceFixture';
import { expectedTokenUsage } from '../../support/trackerCodexUsageExpectation';
import {
	verifyClaudeLinkage,
	verifyClaudeStartupRejection,
	verifyOwnedWorktreeTrust,
	verifyStartErrorCause
} from '../../support/trackerClaudeStartupFixture';

const itemId = 'abc123def4';
const node = 'daniel-primary-mbp';

test(
	'the configured foreground completes managed runs through the normal Tracker done request',
	{ timeout: 60_000 },
	() =>
		measureWorkload('service.projects-sessions-tracker-node', 'managed-foreground', async () => {
			await withTempRepo(proveManagedForeground);
			if (process.platform === 'darwin') {
				await measureWorkload(
					'service.projects-sessions-tracker-native-runtime',
					'codex-usage-receipt',
					async () => {
						await withTempRepo((repo) => proveNativeUsage(repo, false));
						await withTempRepo((repo) => proveNativeUsage(repo, true));
						await withTempRepo((repo) => proveNativeUsage(repo, false, join(repo.root, 'ops')));
						await withTempRepo((repo) => verifyClaudeStartupRejection(repo, 'signed-out'));
						await withTempRepo((repo) => verifyClaudeStartupRejection(repo, 'onboarding'));
						await withTempRepo((repo) => verifyClaudeStartupRejection(repo, 'untrusted'));
						await withTempRepo((repo) => verifyClaudeStartupRejection(repo, 'crash'));
						await withTempRepo(verifyOwnedWorktreeTrust);
						await withTempRepo(verifyClaudeLinkage);
						await withTempRepo(verifyStartErrorCause);
					}
				);
			}
		})
);

async function proveManagedForeground({ root, git }: TemporaryRepo) {
	git('commit', '--allow-empty', '-m', 'Fixture source');
	git('remote', 'add', 'origin', 'git@github.com:Greymass/synthetic.git');
	const { config, profiles } = managedFixtureBindings(root);
	const database = new DatabaseSync(':memory:');
	const signal = new AbortController().signal;
	try {
		const runtime = new TrackerNativeRuntimeService(database, {
			...onIdleHost(
				trackerNodeRuntime(managedForegroundConfig(root, config), (scope) => {
					expect(scope).toMatchObject({ itemId, apiPort: 49281 });
					const run = database
						.prepare('SELECT auto_token, attempt FROM runs WHERE id = ?')
						.get(scope.runId);
					expect(JSON.parse(scope.key)).toEqual([itemId, run?.auto_token, run?.attempt]);
					writeFileSync(scope.path, 'synthetic host-signer fixture', { flag: 'wx', mode: 0o600 });
				})
			),
			now: () => Date.now()
		});
		seedManagedBriefItems(runtime, itemId);
		expect((await managedTrackerItemRequest(runtime, itemId, 'launch')).status).toBe(200);
		await runtime.scheduler!.tick(signal);
		expect(database.prepare('SELECT state,tmux FROM runs').all()).toEqual([
			{ state: 'running', tmux: 'auto-abc123-r1' }
		]);
		expect((await managedTrackerItemRequest(runtime, itemId, 'done')).status).toBe(200);
		await runtime.scheduler!.tick(signal);
		expect(database.prepare('SELECT state,outcome FROM runs').all()).toEqual([
			{ state: 'finished', outcome: 'done' }
		]);
		const outputs = readFileSync(join(profiles.docker, 'invoked.ndjson'), 'utf8')
			.trim()
			.split('\n');
		expect(outputs).toHaveLength(1);
		const launched = JSON.parse(outputs[0]);
		expect(launched).toMatchObject({
			brief: expect.stringContaining('tracker done abc123'),
			guestAuthFile: expect.stringMatching(/\/effects\/[a-f0-9]{64}\/guest-auth\.json$/)
		});
		verifyManagedBrief(launched, root);
		expect(launched.guestAuthFile.startsWith(launched.cwd + '/')).toBe(false);
		expect(existsSync(launched.guestAuthFile)).toBe(false);
		await verifyLostSession(runtime, database, config.stateDirectory);
		await verifyCancelledClaim(runtime, database, config.stateDirectory, itemId);
		await verifyExpiredClaim(runtime, database, config.stateDirectory, itemId);
		await verifyLegacyQueuedClaim(runtime, database, root, itemId);
	} finally {
		database.close();
	}
}

async function proveNativeUsage({ root, git }: TemporaryRepo, competing: boolean, ops?: string) {
	if (ops) mkdirSync(ops, { mode: 0o700 });
	else git('commit', '--allow-empty', '-m', 'Fixture source');
	const { config } = managedFixtureBindings(root);
	if (competing) writeFileSync(join(root, 'competing-codex-transcript'), '', { mode: 0o600 });
	const database = new DatabaseSync(':memory:');
	const signal = new AbortController().signal;
	try {
		const runtime = new TrackerNativeRuntimeService(
			database,
			onIdleHost(trackerNodeRuntime(managedForegroundConfig(root, config, 'macos', ops)))
		);
		runtime.store.appendLocal({
			itemId,
			fields: {
				title: 'Synthetic Codex work',
				model: 'sol',
				status: 'open',
				kind: 'task',
				...(ops ? { agent: 'cos', due: '2000-01-01', created_by: node } : { project: 'Harness' })
			}
		});
		if (ops) {
			await runtime.scheduler!.tick(signal);
			expect(database.prepare('SELECT state FROM runs').all()).toEqual([]);
			expect(runtime.duePreview.preview?.(itemId)).toMatchObject({
				reason: expect.stringContaining('Chief of Staff')
			});
		}
		expect((await managedTrackerItemRequest(runtime, itemId, 'launch')).ok).toBe(true);
		await runtime.scheduler!.tick(signal);
		if (ops) verifyInPlaceBrief(config, ops);
		expect(database.prepare('SELECT state FROM runs').get()).toEqual({ state: 'running' });
		expect((await managedTrackerItemRequest(runtime, itemId, 'done')).ok).toBe(true);
		await runtime.scheduler!.tick(signal);
		expect(
			database
				.prepare(
					'SELECT state,outcome,input_tokens,output_tokens,cache_read_tokens,cache_write_tokens,credits_balance FROM runs'
				)
				.get()
		).toEqual({
			state: 'finished',
			outcome: 'done',
			...expectedTokenUsage(Boolean(competing || ops))
		});
	} finally {
		database.close();
	}
}

async function verifyLostSession(
	runtime: TrackerNativeRuntimeService,
	database: DatabaseSync,
	attempts: string
) {
	const signal = new AbortController().signal;
	expect((await managedTrackerItemRequest(runtime, itemId, 'reopen')).ok).toBe(true);
	expect((await managedTrackerItemRequest(runtime, itemId, 'unlaunch')).ok).toBe(true);
	expect((await managedTrackerItemRequest(runtime, itemId, 'launch')).ok).toBe(true);
	await runtime.scheduler!.tick(signal);
	const active = readdirSync(attempts).find((entry) => {
		const path = join(attempts, entry, 'receipt.json');
		return existsSync(path) && JSON.parse(readFileSync(path, 'utf8')).runId === 2;
	});
	expect(active).toBeDefined();
	const attempt = join(attempts, active!);
	const brief = readFileSync(join(attempt, 'brief.md'), 'utf8');
	expect(brief).toMatch(/## Earlier attempts[\s\S]+run 1[^\n]*done/);
	expect(brief).toMatch(/earlier attempt.*branches.*uncommitted changes.*open PRs/i);
	unlinkSync(join(attempt, 'exit'));
	const probe = join(attempts, '..', 'tmux-presence');
	const token = readFileSync(join(attempt, 'started'), 'utf8').trim();
	for (const reply of [`HARNESS_TRACKER_ATTEMPT=${token}`, 'tmux inventory permission denied']) {
		writeFileSync(probe, reply);
		await runtime.scheduler!.tick(signal);
		expect(database.prepare('SELECT state FROM runs WHERE id = 2').get()).toEqual({
			state: 'running'
		});
	}
	unlinkSync(probe);
	await runtime.scheduler!.tick(signal);
	expect(database.prepare('SELECT state,outcome FROM runs WHERE id = 2').get()).toEqual({
		state: 'finished',
		outcome: 'abandoned'
	});
	expect((await managedTrackerItemRequest(runtime, itemId, 'launch')).ok).toBe(true);
	await runtime.scheduler!.tick(signal);
	expect(database.prepare('SELECT state FROM runs WHERE id = 3').get()).toEqual({
		state: 'running'
	});
}
