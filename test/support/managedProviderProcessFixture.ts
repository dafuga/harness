import { $ } from 'bun';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { ManagedProviderDockerAdapter } from '../../src/adapters/agents-providers/ManagedProviderDockerAdapter';
import { taskProcess } from '../../src/adapters/agents-providers/module-task-runner-adapter/taskProcess';
import type { TaskRunInput } from '../../src/repositories/agents-providers/ModuleTaskRepository.types';
import { abandonLegacyBind } from './managedProviderLegacyDockerFixture';

const taskLabel = 'org.harness.managed-provider-task';
const storageLabel = 'org.harness.managed-provider-storage';

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
	const stopped = await restartAfterCrash(input);
	console.log(JSON.stringify({ exit: { code: exit.code, stdout: exit.stdout }, ...stopped }));
}

async function restartAfterCrash(input: Omit<TaskRunInput, 'signal'>) {
	const root = dirname(input.cwd);
	const abandoned = await holdContainer(join(root, 'abandoned'));
	try {
		const bystander = await holdContainer(join(root, 'live-bystander'));
		try {
			return await exerciseRestart(input, abandoned, bystander);
		} finally {
			await disposeHeldContainer(bystander);
		}
	} finally {
		await disposeHeldContainer(abandoned);
	}
}

async function exerciseRestart(
	input: Omit<TaskRunInput, 'signal'>,
	abandoned: Awaited<ReturnType<typeof holdContainer>>,
	bystander: Awaited<ReturnType<typeof holdContainer>>
) {
	const legacy = await abandonLegacyBind(join(dirname(input.cwd), 'legacy'));
	try {
		abandoned.child.kill('SIGKILL');
		await abandoned.child.exited;
		assert.equal(abandoned.child.signalCode, 'SIGKILL');
		assert.equal(await running(abandoned.guest.id), true);
		assert.notEqual(await storageContainers(abandoned.guest.owner), '');
		const stopped = await cancelRunningContainer(input);
		const recovered = await guestRemoved(abandoned.guest);
		const legacyRecovered = !(await taskContainerIds()).includes(legacy);
		const liveBystanderPreserved =
			(await running(bystander.guest.id)) && !(await guestRemoved(bystander.guest));
		await $`docker exec ${bystander.guest.id} touch /workspace/finish`.quiet();
		assert.equal(await bystander.child.exited, 0);
		const cachedImage =
			await $`docker image inspect --format '{{.Id}}' ${process.env.HARNESS_TASK_DOCKER_IMAGE}`
				.quiet()
				.text();
		return {
			...stopped,
			recovered,
			legacyRecovered,
			liveBystanderPreserved,
			liveBystanderRemovedOnExit: await guestRemoved(bystander.guest),
			cachedImagePreserved: cachedImage.trim() === process.env.HARNESS_TASK_DOCKER_IMAGE
		};
	} finally {
		if ((await taskContainerIds()).includes(legacy)) await $`docker rm --force ${legacy}`.quiet();
	}
}

async function holdContainer(cwd: string) {
	await mkdir(cwd);
	const marker = randomUUID();
	const child = Bun.spawn([process.execPath, import.meta.path, cwd, 'hold', marker], {
		stdout: 'inherit',
		stderr: 'inherit'
	});
	try {
		const guest = await Promise.race([
			waitForReady(marker, cwd),
			child.exited.then(() => {
				throw new Error('Fixture supervisor exited before readiness.');
			})
		]);
		return { child, guest };
	} catch (error) {
		if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
		await child.exited;
		throw error;
	}
}

async function disposeHeldContainer({ child, guest }: Awaited<ReturnType<typeof holdContainer>>) {
	if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
	await child.exited;
	if ((await taskContainerIds()).includes(guest.id)) await $`docker rm --force ${guest.id}`.quiet();
	const storage = await storageContainers(guest.owner);
	if (storage) await $`docker rm --force ${storage}`.quiet();
	if (await volumeExists(guest.volume)) await $`docker volume rm ${guest.volume}`.quiet();
}

async function hold(cwd: string, marker: string) {
	process.exitCode = await new ManagedProviderDockerAdapter().run(
		[
			'/bin/sh',
			'-ec',
			'touch ready; for i in $(seq 1 60); do [ ! -f finish ] || exit 0; sleep 1; done; exit 1',
			marker
		],
		{ cwd, image: process.env.HARNESS_TASK_DOCKER_IMAGE!, signal: AbortSignal.timeout(70000) },
		(child) =>
			new Promise<number>((resolve, reject) => {
				child.stderr.pipe(process.stderr);
				child.once('error', reject);
				child.once('close', (code) => resolve(code ?? 1));
			})
	);
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
	let guest: Awaited<ReturnType<typeof waitForReady>>;
	try {
		guest = await Promise.race([premature, waitForReady(marker, input.cwd)]);
	} finally {
		controller.abort();
		await pending;
	}
	const { stop } = await pending;
	assert.equal(await Bun.file(join(input.cwd, 'ready')).exists(), true);
	return {
		interrupted: stop,
		removed: await guestRemoved(guest)
	};
}

async function waitForReady(marker: string, cwd: string) {
	const deadline = Date.now() + 12000;
	do {
		for (const id of await taskContainerIds()) {
			const guest = await inspectGuest(id, marker, basename(cwd));
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

async function storageContainers(owner: string) {
	return (
		await $`docker ps -aq --no-trunc --filter label=${storageLabel}=${owner}`.quiet().text()
	).trim();
}

async function volumeExists(volume: string) {
	const observed = await $`docker volume ls -q --filter name=${volume}`.quiet().text();
	return observed.trim().split('\n').includes(volume);
}

async function guestRemoved(guest: { id: string; owner: string; volume: string }) {
	return (
		!(await taskContainerIds()).includes(guest.id) &&
		!(await storageContainers(guest.owner)) &&
		!(await volumeExists(guest.volume))
	);
}

async function running(id: string) {
	const state = await $`docker inspect --format '{{.State.Running}}' ${id}`.quiet().nothrow();
	return state.exitCode === 0 && state.text().trim() === 'true';
}

async function inspectGuest(id: string, marker: string, subpath: string) {
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
	const owner = guest.Config.Labels[taskLabel];
	assert.equal(mounts[0].Name, `harness-task-${owner}`);
	assert.match(owner, /^[a-f0-9-]{36}$/);
	assert.equal(host.Mounts[0].VolumeOptions.Subpath, subpath);
	return { id, owner, volume: mounts[0].Name as string };
}

if (process.argv[3] === 'hold') await hold(process.argv[2], process.argv[4]);
else await run(process.argv[2]);
