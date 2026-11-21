import { $ } from 'bun';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { taskProcess } from '../../src/adapters/agents-providers/module-task-runner-adapter/taskProcess';
import type { TaskRunInput } from '../../src/repositories/agents-providers/ModuleTaskRepository.types';

const taskLabel = 'org.harness.managed-provider-task';

async function run(cwd: string) {
	cwd = join(await realpath(cwd), 'workspace, with "quotes"');
	await mkdir(cwd);
	await writeFile(join(cwd, 'remove-me'), 'old');
	if (process.platform === 'darwin') {
		await $`xattr -w com.harness.fixture synthetic ${join(cwd, 'remove-me')}`.quiet();
	}
	await writeFile(join(cwd, '.git'), 'host metadata');
	await mkdir(join(cwd, 'node_modules'));
	await writeFile(join(cwd, 'node_modules/host-only'), 'host dependency');
	const input = {
		platform: 'linux',
		provider: 'claude',
		model: 'fixture',
		intelligence: 'medium',
		cwd,
		prompt: 'Prompt ✓'
	} as const;
	const exit = await taskProcess(
		[
			'/bin/sh',
			'-c',
			`set -eu
			test ! -e .git && test ! -e node_modules/host-only && test "$TMPDIR" = /tmp || exit 41
			mkdir -p "$BUN_INSTALL_CACHE_DIR" node_modules
			touch "$BUN_INSTALL_CACHE_DIR/guest-only" node_modules/guest-only "$TMPDIR/test-temp"
			rm remove-me
			printf 'checkpoint ✓' > checkpoint
			cat; printf '\\n[%s]' "$1"; echo diagnostic >&2; exit 37`,
			'fixture',
			'literal $(exit 91); * "'
		],
		{ ...input, signal: AbortSignal.timeout(15000) }
	);
	assert.equal(exit.code, 37, 'Offline guest did not receive the isolated workspace and cache');
	assert.equal(await readFile(join(cwd, 'checkpoint'), 'utf8'), 'checkpoint ✓');
	assert.equal(await readFile(join(cwd, '.git'), 'utf8'), 'host metadata');
	assert.equal(await readFile(join(cwd, 'node_modules/host-only'), 'utf8'), 'host dependency');
	for (const path of ['remove-me', 'test-temp', 'node_modules/guest-only', '.cache/harness/bun']) {
		assert.equal(await Bun.file(join(cwd, path)).exists(), false, path);
	}
	const stopped = await cancelRunningContainer(input);
	console.log(JSON.stringify({ exit: { code: exit.code, stdout: exit.stdout }, ...stopped }));
}

async function cancelRunningContainer(input: Omit<TaskRunInput, 'signal'>) {
	const controller = new AbortController();
	const marker = randomUUID();
	const pending = taskProcess(['/bin/sh', '-c', 'touch ready; sleep 30 & wait', marker], {
		...input,
		signal: controller.signal
	});
	const premature = pending.then(() => {
		throw new Error('Container exited before cancellation.');
	});
	let guest: { id: string; volume: string };
	try {
		guest = await Promise.race([premature, waitForReady(marker)]);
	} finally {
		controller.abort();
		await pending;
	}
	const { stop } = await pending;
	assert.equal(await Bun.file(join(input.cwd, 'ready')).exists(), true);
	const volumes = await $`docker volume ls -q --filter name=${guest.volume}`.quiet().text();
	return {
		interrupted: stop,
		removed: !(await taskContainerIds()).includes(guest.id) && !volumes.trim()
	};
}

async function waitForReady(marker: string) {
	const deadline = Date.now() + 12000;
	do {
		for (const id of await taskContainerIds()) {
			const guest = await inspectGuest(id, marker);
			if (guest) return guest;
		}
		await Bun.sleep(50);
	} while (Date.now() < deadline);
	throw new Error('Linux child did not become ready for cancellation.');
}

async function taskContainerIds() {
	const result = await $`docker ps --all --quiet --no-trunc --filter label=${taskLabel}`
		.quiet()
		.text();
	return result.trim().split(/\s+/).filter(Boolean);
}

async function inspectGuest(id: string, marker: string) {
	const result = await $`docker inspect ${id}`.quiet().nothrow();
	if (result.exitCode !== 0) return undefined;
	const [guest] = JSON.parse(result.text());
	if (!guest.Config.Cmd?.includes(marker) || !guest.State.Running) return undefined;
	const ready = await $`docker exec ${id} test -f /workspace/ready`.quiet().nothrow();
	if (ready.exitCode !== 0) return undefined;
	const { HostConfig: host, Mounts: mounts } = guest;
	assert.match(guest.Config.User, /^[1-9]\d*:\d+$/);
	assert.equal(host.NetworkMode, 'none');
	assert.equal(host.ReadonlyRootfs, true);
	assert.equal(host.Privileged, false);
	assert.deepEqual(host.CapDrop, ['ALL']);
	assert.deepEqual(host.SecurityOpt, ['no-new-privileges']);
	assert.equal(host.Tmpfs['/tmp'], 'rw,nosuid,nodev,size=256m');
	assert.equal(mounts.length, 1);
	assert.equal(mounts[0].Type, 'volume');
	assert.equal(mounts[0].Destination, '/workspace');
	return { id, volume: mounts[0].Name };
}

await run(process.argv[2]);
