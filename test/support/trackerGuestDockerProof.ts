import { Database } from 'bun:sqlite';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { taskProcess } from '../../src/adapters/agents-providers/module-task-runner-adapter/taskProcess';
import { persistDispatchRun } from '../../src/repositories/projects-sessions/tracker-dispatch-repository/dispatchRunRows';
import { attemptKey } from '../../src/services/agents-providers/tracker-dispatcher-service/launchEligibility';
import type { TrackerRunReceipt } from '../../src/services/agents-providers/TrackerDispatcherService.types';
import { TrackerNativeRuntimeService } from '../../src/services/projects-sessions/TrackerNativeRuntimeService';
import { TrackerSupervisorService } from '../../src/services/projects-sessions/TrackerSupervisorService';
import {
	bindTrackerListener,
	trackerNodeApi,
	unavailable
} from '../../src/services/projects-sessions/tracker-node-service/trackerNodeListeners';
import { trackerNodeRuntime } from '../../src/services/projects-sessions/tracker-node-service/trackerNodeRuntime';
import { guestRemoved, waitForReady } from './managedProviderDockerFixtureState';
import { managedFixtureBindings } from './trackerManagedProcessFixture';
import { trackerGuestDockerWorker } from './trackerGuestDockerWorker';

const itemId = 'guest12345';
const node = 'synthetic-docker-node';
const startPrompt = 'Unicode fixture ✓';

async function runProof(root: string, image: string) {
	const controller = new AbortController();
	const database = new Database(join(root, 'tracker.sqlite'));
	let handle = (_: Request): Response | Promise<Response> => unavailable();
	const listener = bindTrackerListener(0, 'api', controller.signal, (request) => handle(request));
	try {
		const config = await proofConfig(root, listener.port);
		const options = trackerNodeRuntime(config);
		const runtime = new TrackerNativeRuntimeService(database, options);
		const supervisor = new TrackerSupervisorService(runtime);
		handle = (request) => trackerNodeApi(request, runtime, supervisor, 'synthetic');
		const run = seedAssignedRun(runtime);
		const authFile = join(root, 'guest-auth.json');
		const write = options.hostEffects?.workerClient?.writeGuestAuth;
		assert(write, 'Native service did not configure scoped Docker Tracker signing');
		write({ path: authFile, itemId, runId: run.id, apiPort: listener.port, key: attemptKey(run) });
		await runDockerGuest({ root, image, authFile }, controller.signal);
		assert(runtime.scheduler);
		await runtime.scheduler.tick(controller.signal);
		assert.deepEqual(database.prepare('SELECT state, outcome FROM runs WHERE id = ?').get(run.id), {
			state: 'finished',
			outcome: 'done'
		});
		const result = await runtime.items.handle(
			new Request('http://tracker-fixture.invalid/items/' + itemId)
		);
		const item = await result.json();
		assert.equal(item.status, 'done');
		assert.deepEqual(
			item.notes_log.map(({ text }: { text: string }) => text),
			['Guest retry ✓', 'Working', 'Verified']
		);
		assert.equal(item.question, 'Synthetic review');
		assert.equal(runtime.store.maxSeq(), 6);
		console.log(
			JSON.stringify({
				item: 'done',
				run: run.id,
				journalWrites: runtime.store.maxSeq(),
				cleanup: true
			})
		);
	} finally {
		controller.abort();
		await listener.close();
		database.close();
	}
}

async function runDockerGuest(
	{ root, image, authFile }: { root: string; image: string; authFile: string },
	signal: AbortSignal
) {
	const cwd = join(root, 'worktree');
	await mkdir(cwd);
	Object.assign(process.env, {
		HARNESS_TASK_DOCKER_IMAGE: image,
		HARNESS_TRACKER_GUEST_AUTH_FILE: authFile,
		HARNESS_RESOURCES_HOME: join(root, 'resources'),
		HARNESS_RESOURCE_LEASE: '',
		TRACKER_ITEM_ID: itemId,
		TRACKER_RUN_ID: '41',
		ANTHROPIC_API_KEY: 'synthetic-canary'
	});
	const marker = randomUUID();
	const stop = new AbortController();
	const runSignal = AbortSignal.any([signal, stop.signal, AbortSignal.timeout(30_000)]);
	const pending = taskProcess(['/bin/sh', '-c', trackerGuestDockerWorker, marker], {
		cwd,
		signal: runSignal,
		platform: 'linux',
		provider: 'claude',
		model: 'synthetic',
		intelligence: 'medium',
		prompt: startPrompt
	});
	await proveDockerLifecycle(pending, marker, cwd, stop);
}

async function proveDockerLifecycle(
	process: ReturnType<typeof taskProcess>,
	marker: string,
	cwd: string,
	stop: AbortController
) {
	let guest: Awaited<ReturnType<typeof waitForReady>> | undefined;
	try {
		guest = await Promise.race([
			waitForReady(marker, cwd),
			process.then(({ code }) => {
				throw new Error('Guest stopped before isolation inspection: ' + code);
			})
		]);
		const released = Bun.spawn(['docker', 'exec', guest.id, 'touch', '/workspace/continue']);
		assert.equal(await released.exited, 0, 'Could not release the inspected guest');
		const { code, stdout } = await process;
		assert.equal(code, 0, 'Guest tracker command or isolation check failed');
		assert.equal(stdout, startPrompt + '\nProvider completed');
	} finally {
		stop.abort();
		await process.catch(() => {});
		if (guest)
			assert(
				await guestRemoved(guest),
				'The task container, staging container or volume survived cleanup'
			);
	}
}

async function proofConfig(root: string, apiPort: number) {
	const syncSecretFile = join(root, 'synthetic-key');
	await writeFile(syncSecretFile, randomBytes(32).toString('hex'), { mode: 0o600 });
	const { config } = managedFixtureBindings(root);
	return {
		version: 1,
		node,
		role: 'hub',
		apiPort,
		syncPort: 0,
		database: join(root, 'tracker.sqlite'),
		syncSecretFile,
		legacyFenceFile: join(root, 'unused.fence'),
		hostEffects: {
			mode: 'active',
			checkpoint: 'synthetic-only',
			launch: { managed: config, repositories: {} }
		}
	} as const;
}

function seedAssignedRun(runtime: TrackerNativeRuntimeService): TrackerRunReceipt {
	const now = Date.now();
	const auto = 'synthetic-claim';
	runtime.store.appendLocal({
		itemId,
		fields: {
			title: 'Synthetic Docker task',
			status: 'open',
			auto,
			kind: 'task',
			notes: 'a'.repeat(9000) + 'read-back sentinel'
		}
	});
	const run: TrackerRunReceipt = {
		id: 41,
		item_id: itemId,
		node,
		auto_token: auto,
		attempt: 1,
		launch_source: 'manual',
		state: 'running',
		outcome: null,
		failure_reason: null,
		pinned: true,
		cli: 'claude',
		model: 'synthetic',
		effort: 'medium',
		rung: 'fixture',
		project: null,
		reason: null,
		kind: 'task',
		escalated_from: null,
		revision: 1,
		queued_at: now,
		dispatch_at: now,
		started_at: now,
		ended_at: null,
		eta_at: null
	};
	persistDispatchRun(runtime.store, run, node);
	return run;
}

const image = process.argv[2];
assert(/^sha256:[a-f0-9]{64}$/.test(image ?? ''), 'Pass a pinned local synthetic image');
const root = await mkdtemp('/tmp/htrk-mb2-');
try {
	await runProof(root, image);
} finally {
	await rm(root, { recursive: true, force: true });
}
