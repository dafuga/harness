import {
	existsSync,
	mkdirSync,
	readFileSync,
	readdirSync,
	realpathSync,
	unlinkSync,
	writeFileSync
} from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { expect, test } from 'vitest';
import { TrackerNativeRuntimeService } from '../../../src/services/projects-sessions/TrackerNativeRuntimeService';
import { trackerNodeRuntime } from '../../../src/services/projects-sessions/tracker-node-service/trackerNodeRuntime';
import { withTempRepo } from '../../support/temporary';
import { seedManagedFixtureOrigin } from '../../support/trackerManagedGitFixture';
import type { TemporaryRepo } from '../../support/temporary.types';
import { measureWorkload } from '../../support/measureWorkload';
import {
	managedFixtureBindings,
	managedForegroundConfig,
	managedTrackerItemRequest
} from '../../support/trackerManagedProcessFixture';
import {
	verifyCancelledClaim,
	verifyExpiredClaim,
	verifyLegacyQueuedClaim
} from '../../support/trackerManagedLaunchAssertions';

import { verifyClaudeStartupRejection } from '../../support/trackerClaudeStartupFixture';

const itemId = 'abc123def4';
const node = 'daniel-primary-mbp';

test(
	'the configured foreground completes managed runs through the normal Tracker done request',
	{ timeout: 15_000 },
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
					}
				);
			}
		})
);

async function proveManagedForeground(repo: TemporaryRepo) {
	const { root } = repo;
	seedManagedFixtureOrigin(repo);
	const { config, profiles } = managedFixtureBindings(root);
	const database = new DatabaseSync(':memory:');
	const signal = new AbortController().signal;
	try {
		const runtime = new TrackerNativeRuntimeService(database, {
			...trackerNodeRuntime(managedForegroundConfig(root, config), (scope) => {
				expect(scope).toMatchObject({ itemId, apiPort: 49281 });
				const run = database
					.prepare('SELECT auto_token, attempt FROM runs WHERE id = ?')
					.get(scope.runId);
				expect(JSON.parse(scope.key)).toEqual([itemId, run?.auto_token, run?.attempt]);
				writeFileSync(scope.path, 'synthetic host-signer fixture', { flag: 'wx', mode: 0o600 });
			}),
			now: () => Date.now()
		});
		runtime.store.appendLocal({
			itemId,
			fields: { title: 'Synthetic Docker work', status: 'open', kind: 'task', project: 'Harness' }
		});
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

async function proveNativeUsage(repo: TemporaryRepo, competing: boolean, ops?: string) {
	const { root } = repo;
	if (ops) mkdirSync(ops, { mode: 0o700 });
	else seedManagedFixtureOrigin(repo);
	const { config } = managedFixtureBindings(root);
	if (competing) writeFileSync(join(root, 'competing-codex-transcript'), '', { mode: 0o600 });
	const database = new DatabaseSync(':memory:');
	const signal = new AbortController().signal;
	try {
		const runtime = new TrackerNativeRuntimeService(
			database,
			trackerNodeRuntime(managedForegroundConfig(root, config, 'macos', ops))
		);
		runtime.store.appendLocal({
			itemId,
			fields: {
				title: 'Synthetic Codex work',
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
		if (ops) {
			const invocation = JSON.parse(
				readFileSync(join(config.native.profile, 'invoked.ndjson'), 'utf8')
			);
			expect(invocation.cwd).toBe(realpathSync(ops));
		}
		expect(database.prepare('SELECT state FROM runs').get()).toEqual({ state: 'running' });
		expect((await managedTrackerItemRequest(runtime, itemId, 'done')).ok).toBe(true);
		await runtime.scheduler!.tick(signal);
		expect(
			database
				.prepare(
					'SELECT state,outcome,input_tokens,output_tokens,cache_read_tokens,cache_write_tokens FROM runs'
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

function expectedTokenUsage(missing: boolean) {
	if (!missing)
		return { input_tokens: 95, output_tokens: 10, cache_read_tokens: 25, cache_write_tokens: 0 };
	return {
		input_tokens: null,
		output_tokens: null,
		cache_read_tokens: null,
		cache_write_tokens: null
	};
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
