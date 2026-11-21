import { $ } from 'bun';
import { mkdir, realpath, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ManagedProviderDockerAdapter } from '../../src/adapters/agents-providers/ManagedProviderDockerAdapter';
import { taskProcess } from '../../src/adapters/agents-providers/module-task-runner-adapter/taskProcess';
import type { TaskRunInput } from '../../src/repositories/agents-providers/ModuleTaskRepository.types';

const taskLabel = 'org.harness.managed-provider-task';

async function run(root: string) {
	root = await realpath(root);
	const cwd = join(root, 'workspace, with "quotes"');
	await mkdir(cwd);
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
			'cat; printf "\\n[%s]" "$1"; echo diagnostic >&2; exit 37',
			'fixture',
			'literal $(exit 91); * "'
		],
		{ ...input, signal: AbortSignal.timeout(15000) }
	);
	const restarted = await restartAfterCrash(root, input);
	console.log(JSON.stringify({ exit: { code: exit.code, stdout: exit.stdout }, ...restarted }));
}

async function restartAfterCrash(root: string, input: Omit<TaskRunInput, 'signal'>) {
	const abandoned = await holdContainer(join(root, 'abandoned'));
	try {
		const bystander = await holdContainer(join(root, 'live-bystander'));
		try {
			abandoned.child.kill('SIGKILL');
			await abandoned.child.exited;
			if (abandoned.child.signalCode !== 'SIGKILL' || !(await running(abandoned.id)))
				throw new Error('SIGKILL did not leave a running task container.');
			const stopped = await cancelRunningContainer(input);
			const recovered = !(await taskContainerIds()).includes(abandoned.id);
			const liveBystanderPreserved = await running(bystander.id);
			await writeFile(join(bystander.cwd, 'finish'), '');
			if ((await bystander.child.exited) !== 0) throw new Error('Live bystander failed.');
			const liveBystanderRemovedOnExit = !(await taskContainerIds()).includes(bystander.id);
			const cachedImagePreserved =
				(
					await $`docker image inspect --format '{{.Id}}' ${process.env.HARNESS_TASK_DOCKER_IMAGE}`
						.quiet()
						.text()
				).trim() === process.env.HARNESS_TASK_DOCKER_IMAGE;
			return {
				...stopped,
				recovered,
				liveBystanderPreserved,
				liveBystanderRemovedOnExit,
				cachedImagePreserved
			};
		} finally {
			await disposeHeldContainer(bystander);
		}
	} finally {
		await disposeHeldContainer(abandoned);
	}
}

async function holdContainer(cwd: string) {
	await mkdir(cwd);
	const child = Bun.spawn([process.execPath, import.meta.path, cwd, 'hold'], {
		stdout: 'inherit',
		stderr: 'inherit'
	});
	try {
		await Promise.race([
			waitForReady(join(cwd, 'ready')),
			child.exited.then(() => {
				throw new Error('Fixture supervisor exited before readiness.');
			})
		]);
		return { child, cwd, id: await containerForWorkspace(cwd) };
	} catch (error) {
		await disposeHeldContainer({ child, cwd, id: undefined });
		throw error;
	}
}

async function disposeHeldContainer({
	child,
	cwd,
	id
}:
	| Awaited<ReturnType<typeof holdContainer>>
	| {
			child: ReturnType<typeof Bun.spawn>;
			cwd: string;
			id: undefined;
	  }) {
	if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
	await child.exited;
	const current = await containerForWorkspace(cwd).catch(() => undefined);
	if (current && (!id || current === id)) await $`docker rm --force ${current}`.quiet();
}

async function running(id: string) {
	const state = await $`docker inspect --format '{{.State.Running}}' ${id}`.quiet().nothrow();
	return state.exitCode === 0 && state.text().trim() === 'true';
}

async function hold(cwd: string) {
	process.exitCode = await new ManagedProviderDockerAdapter().run(
		[
			'/bin/sh',
			'-ec',
			'touch ready; for i in $(seq 1 60); do [ ! -f finish ] || exit 0; sleep 1; done; exit 1'
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
	const pending = taskProcess(['/bin/sh', '-c', 'touch ready; sleep 30 & wait'], {
		...input,
		signal: controller.signal
	});
	const premature = pending.then(() => {
		throw new Error('Container exited before cancellation.');
	});
	let container: string;
	try {
		await Promise.race([premature, waitForReady(join(input.cwd, 'ready'))]);
		container = await containerForWorkspace(input.cwd);
	} finally {
		controller.abort();
		await pending;
	}
	const { stop } = await pending;
	return { interrupted: stop, removed: !(await taskContainerIds()).includes(container) };
}

async function waitForReady(file: string) {
	const deadline = Date.now() + 12000;
	do {
		if (await Bun.file(file).exists()) return;
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

async function containerForWorkspace(cwd: string) {
	for (const id of await taskContainerIds()) {
		const mounts =
			await $`docker inspect --format '{{range .Mounts}}{{println .Source}}{{end}}' ${id}`
				.quiet()
				.text();
		if (
			mounts
				.trim()
				.split('\n')
				.some((source) => source === cwd || source === '/host_mnt' + cwd)
		)
			return id;
	}
	throw new Error('Could not identify the fixture workspace container.');
}

if (process.argv[3] === 'hold') await hold(process.argv[2]);
else await run(process.argv[2]);
