// @harness-uid u_ymrcybx25k
import { spawn } from 'node:child_process';
import type { ChildProcessWithoutNullStreams } from 'node:child_process';
import { realpath } from 'node:fs/promises';
import type {
	DockerTaskCreate,
	DockerTaskDaemon,
	DockerTaskWorkspace,
	DockerVolumeLaunch
} from './ManagedProviderDockerAdapter.types';
import { ModuleTaskRunError } from './module-task-runner-adapter/ModuleTaskRunError';
import {
	createContainer,
	createStorageContainer,
	createVolume,
	dockerArgs,
	dockerDaemon,
	requireDaemon,
	requireWorkspaceImage,
	taskLabel
} from './managed-provider-docker-adapter/dockerControl';
import {
	removeLaunch,
	removeScopedContainer
} from './managed-provider-docker-adapter/dockerContainerScope';
import {
	newLaunch,
	launchDirectory,
	recoverLaunches,
	forgetLaunch,
	writeLaunch
} from './managed-provider-docker-adapter/dockerLaunchJournal';
import {
	bunCache,
	recoverDockerWorkspace,
	seedDockerWorkspace,
	workspaceSubpath,
	workspaceVolume
} from './managed-provider-docker-adapter/dockerWorkspace';

export const managedProviderDockerResources = { cpus: 2, memoryMiB: 6144 };

/** Run a local, offline Linux fixture with a task-owned workspace volume. */
export class ManagedProviderDockerAdapter {
	command([executable, ...args]: string[], task: DockerTaskCreate): string[] {
		const { cpus, memoryMiB } = managedProviderDockerResources;
		return [
			'create',
			'--interactive',
			'--init',
			'--pull=never',
			'--network=none',
			'--cap-drop=ALL',
			'--security-opt=no-new-privileges',
			'--read-only',
			'--no-healthcheck',
			'--log-driver=none',
			'--pids-limit=256',
			`--cpus=${cpus}`,
			`--memory=${memoryMiB}m`,
			`--memory-swap=${memoryMiB}m`,
			`--user=${task.user}`,
			'--tmpfs=/tmp:rw,nosuid,nodev,size=256m',
			'--env=HOME=/tmp',
			'--env=TMPDIR=/tmp',
			`--env=BUN_INSTALL_CACHE_DIR=/workspace/${bunCache}`,
			`--mount=type=volume,source=${workspaceVolume(task.owner)},target=/workspace,volume-nocopy,${workspaceSubpath(task.cwd)}`,
			'--workdir=/workspace',
			`--label=${taskLabel}=${task.owner}`,
			`--entrypoint=${executable}`,
			task.image,
			...args
		];
	}

	async run<T>(
		command: string[],
		workspace: DockerTaskWorkspace,
		collect: (child: ChildProcessWithoutNullStreams) => Promise<T>
	): Promise<T> {
		workspace.signal.throwIfAborted();
		const user = dockerUser();
		const cwd = await realpath(workspace.cwd);
		const daemon = await dockerDaemon();
		const directory = await launchDirectory(cwd);
		await recoverLaunches(directory, daemon, workspace.signal);
		await requireWorkspaceImage(daemon, workspace.image);
		workspace.signal.throwIfAborted();
		const launch = newLaunch(daemon, cwd);
		const task = { ...workspace, cwd, owner: launch.owner, user };
		await writeLaunch(directory, launch);
		if (workspace.signal.aborted) {
			await forgetLaunch(directory, launch);
			workspace.signal.throwIfAborted();
		}
		try {
			const storage = await stageWorkspace(daemon, launch, task, directory);
			const id = await createContainer(daemon, this.command(command, task));
			launch.containerId = id;
			await writeLaunch(directory, launch);
			workspace.signal.throwIfAborted();
			try {
				return await collect(attachContainer(daemon, id));
			} finally {
				await exportWorkspace(daemon, launch, storage);
			}
		} finally {
			if (await removeLaunch(daemon, launch)) await forgetLaunch(directory, launch);
		}
	}
}

async function stageWorkspace(
	daemon: DockerTaskDaemon,
	launch: DockerVolumeLaunch,
	task: DockerTaskCreate & Pick<DockerTaskWorkspace, 'signal'>,
	directory: string
): Promise<string> {
	await createVolume(daemon, launch.owner);
	launch.stage = 'storage';
	await writeLaunch(directory, launch);
	const storage = await createStorageContainer(daemon, task);
	launch.storageId = storage;
	await writeLaunch(directory, launch);
	await seedDockerWorkspace(daemon, storage, task.cwd, task.signal);
	task.signal.throwIfAborted();
	launch.stage = 'task';
	await writeLaunch(directory, launch);
	return storage;
}

async function exportWorkspace(
	daemon: DockerTaskDaemon,
	launch: DockerVolumeLaunch,
	storage: string
) {
	// Retire the task before exporting edits, even if its attach client was killed.
	await removeScopedContainer(daemon, launch);
	await requireDaemon(daemon);
	await recoverDockerWorkspace(daemon, storage, launch.cwd);
}

function attachContainer(daemon: DockerTaskDaemon, id: string) {
	return spawn('docker', dockerArgs(daemon, ['start', '--attach', '--interactive', id]), {
		env: daemon.env,
		stdio: 'pipe',
		detached: true
	});
}

function dockerUser(): string {
	const uid = process.getuid?.();
	const gid = process.getgid?.();
	if (!uid || gid === undefined)
		throw new ModuleTaskRunError('The Linux Docker pilot requires a non-root Unix user.');
	return `${uid}:${gid}`;
}
