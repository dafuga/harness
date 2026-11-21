import { $ } from 'bun';
import { mkdir, realpath } from 'node:fs/promises';
import { join } from 'node:path';
import { taskProcess } from '../../src/adapters/agents-providers/module-task-runner-adapter/taskProcess';
import type { TaskRunInput } from '../../src/repositories/agents-providers/ModuleTaskRepository.types';

const taskLabel = 'org.harness.managed-provider-task';

async function run(cwd: string) {
	cwd = join(await realpath(cwd), 'workspace, with "quotes"');
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
	const stopped = await cancelRunningContainer(input);
	console.log(JSON.stringify({ exit: { code: exit.code, stdout: exit.stdout }, ...stopped }));
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

await run(process.argv[2]);
