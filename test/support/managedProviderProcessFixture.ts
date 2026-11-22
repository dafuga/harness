import { $ } from 'bun';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { ManagedProviderDockerAdapter } from '../../src/adapters/agents-providers/ManagedProviderDockerAdapter';
import { taskProcess } from '../../src/adapters/agents-providers/module-task-runner-adapter/taskProcess';
import type { TaskRunInput } from '../../src/repositories/agents-providers/ModuleTaskRepository.types';
import {
	abandonLegacyBind,
	guestRemoved,
	running,
	storageContainers,
	taskContainerIds,
	volumeExists,
	waitForReady
} from './managedProviderDockerFixtureState';

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
			(await running(bystander.guest.id)) &&
			(await volumeExists(bystander.guest.volume)) &&
			!!(await storageContainers(bystander.guest.owner));
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

if (process.argv[3] === 'hold') await hold(process.argv[2], process.argv[4]);
else await run(process.argv[2]);
