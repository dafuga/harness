import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ManagedProviderDockerAdapter } from '../../src/adapters/agents-providers/ManagedProviderDockerAdapter';
import { taskProcess } from '../../src/adapters/agents-providers/module-task-runner-adapter/taskProcess';
import { TrackerSyncAuthService } from '../../src/services/networking-security/TrackerSyncAuthService';

const itemId = 'fixture001';
const runId = 41;
const target = '/native/guest/v1';
const worker = [
	'/bin/sh',
	'-c',
	`set -eu
	command -v tracker >/dev/null || exit 71
	test "$TRACKER_ITEM_ID/$TRACKER_RUN_ID" = fixture001/41 || exit 74
	test -z "\${HARNESS_TRACKER_GUEST_AUTH_FILE:-}\${HARNESS_TRACKER_CONFIG:-}\${ANTHROPIC_API_KEY:-}" || exit 75
	cat
	tracker start fixture >/dev/null
	tracker note fixture001 'One retry ✓' >/dev/null
	tracker note fixture 'One retry ✓' >/dev/null
	tracker progress fixture001 'Working' >/dev/null
	tracker flag fixture001 'Review needed' >/dev/null
	if tracker note foreign001 'Outside scope' || tracker list || tracker done fixture001 --occurrence 2030-01-01; then exit 72; fi
	tracker show fixture001 --json | grep -q 'read-back sentinel'
	tracker done fixture --note 'Finished' >/dev/null
	tracker show fixture --json | grep -q 'done'
	printf '\\nProvider completed'`
];

function syntheticTracker(key: string) {
	const auth = new TrackerSyncAuthService(Buffer.from(key, 'hex'));
	const requests: string[] = [];
	const writes = new Map<string, string>();
	const server = Bun.serve({
		hostname: '127.0.0.1',
		port: 0,
		async fetch(request) {
			const body = await request.text();
			const method = request.method;
			const pathAndQuery = new URL(request.url).pathname;
			assert.equal(pathAndQuery, target);
			assert.equal(method, 'POST');
			assert(
				auth.verify(
					{ method, pathAndQuery, body },
					request.headers.get('authorization') ?? undefined
				)
			);
			const [item, run, verb, text] = JSON.parse(body);
			assert.equal(item, itemId);
			assert.equal(run, runId);
			assert.deepEqual(
				{ note: 'One retry ✓', progress: 'Working', flag: 'Review needed', done: 'Finished' }[
					verb as 'note'
				],
				text ?? undefined
			);
			requests.push(verb);
			if (verb !== 'show') writes.set(verb + ':' + text, verb);
			return Response.json({
				id: itemId,
				title: 'Fixture',
				status: [...writes.values()].includes('done') ? 'done' : 'in_progress',
				notes: 'n'.repeat(9000) + 'read-back sentinel'
			});
		}
	});
	return { server, requests, writes };
}

function localAttach(root: string, key: string, file: string): ManagedProviderDockerAdapter['run'] {
	return (command, workspace, collect) => {
		assert(!command.some((arg) => arg.includes(key) || arg.includes(file)));
		return collect(
			spawn(command[0], command.slice(1), {
				cwd: workspace.cwd,
				detached: true,
				stdio: 'pipe',
				env: {
					PATH: [
						join(root, 'missing'),
						process.execPath.replace(/\/[^/]+$/, ''),
						'/usr/bin',
						'/bin'
					].join(':'),
					HOME: root,
					TMPDIR: '/tmp'
				}
			})
		);
	};
}

async function main() {
	const root = await mkdtemp('/tmp/htrk-test-');
	const key = randomBytes(32).toString('hex');
	const { server, requests, writes } = syntheticTracker(key);
	const original = ManagedProviderDockerAdapter.prototype.run;
	try {
		const cwd = join(root, 'workspace');
		await mkdir(cwd);
		const file = join(root, 'guest-grant.json');
		await writeFile(file, JSON.stringify({ itemId, runId, apiPort: server.port, key }), {
			mode: 0o600
		});
		Object.assign(process.env, {
			HARNESS_TASK_DOCKER_IMAGE: 'sha256:' + 'a'.repeat(64),
			HARNESS_RESOURCES_HOME: join(root, 'resources'),
			HARNESS_RESOURCE_LEASE: '',
			HARNESS_TRACKER_GUEST_AUTH_FILE: file,
			TRACKER_ITEM_ID: itemId,
			TRACKER_RUN_ID: String(runId),
			ANTHROPIC_API_KEY: 'synthetic-canary'
		});
		ManagedProviderDockerAdapter.prototype.run = localAttach(root, key, file);
		const { code, stdout } = await taskProcess(worker, {
			cwd,
			platform: 'linux',
			prompt: 'Prompt with Unicode ✓',
			provider: 'claude',
			model: 'fixture',
			intelligence: 'medium',
			signal: AbortSignal.timeout(12_000)
		});
		console.log(
			JSON.stringify({ code, providerOutput: stdout, requests, writes: [...writes.values()] })
		);
	} finally {
		ManagedProviderDockerAdapter.prototype.run = original;
		await server.stop(true);
		await rm(root, { recursive: true, force: true });
	}
}

await main();
