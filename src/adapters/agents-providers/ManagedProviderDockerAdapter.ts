// @harness-uid u_ymrcybx25k
import { spawn } from 'node:child_process';
import type { ChildProcessWithoutNullStreams } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { realpath } from 'node:fs/promises';
import type {
	DockerTaskCreate,
	DockerTaskDaemon,
	DockerTaskWorkspace
} from './ManagedProviderDockerAdapter.types';
import { ModuleTaskRunError } from './module-task-runner-adapter/ModuleTaskRunError';
import {
	bunCache,
	recoverDockerWorkspace,
	seedDockerWorkspace,
	workspaceSubpath,
	workspaceVolume
} from './managed-provider-docker-adapter/dockerWorkspace';

import {
	createContainer,
	createStorageContainer,
	createVolume,
	dockerArgs,
	dockerDaemon,
	removeContainers,
	removeVolume,
	stopContainer
} from './managed-provider-docker-adapter/dockerControl';

const taskLabel = 'org.harness.managed-provider-task';
export const managedProviderDockerResources = { cpus: 2, memoryMiB: 6144 };

/** Run a local, offline Linux fixture with task-owned Docker storage. */
export class ManagedProviderDockerAdapter {
	command([executable, ...args]: string[], task: DockerTaskCreate): string[] {
		const { cpus, memoryMiB } = managedProviderDockerResources;
		return [
			'create',
			'--interactive',
			'--init',
			'--pull=never',
			'--platform=linux',
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
		workspace.signal.throwIfAborted();
		const owner = randomUUID();
		const task = { ...workspace, cwd, owner, user };
		await createVolume(daemon, owner);
		try {
			const storage = await createStorageContainer(daemon, task);
			try {
				await seedDockerWorkspace(daemon, storage, cwd, workspace.signal);
				const id = await createContainer(
					daemon,
					this.command(command, task),
					`${taskLabel}=${owner}`
				);
				return await runContainer(daemon, id, { ...task, storage }, collect);
			} finally {
				await removeContainers(daemon, [storage]);
			}
		} finally {
			await removeVolume(daemon, owner);
		}
	}
}

async function runContainer<T>(
	daemon: DockerTaskDaemon,
	id: string,
	task: DockerTaskWorkspace & { storage: string },
	collect: (child: ChildProcessWithoutNullStreams) => Promise<T>
): Promise<T> {
	try {
		task.signal.throwIfAborted();
		const child = spawn('docker', dockerArgs(daemon, ['start', '--attach', '--interactive', id]), {
			env: daemon.env,
			stdio: 'pipe',
			detached: true
		});
		try {
			return await collect(child);
		} finally {
			// A closed attach client can leave its container running after cancellation.
			await stopContainer(daemon, id);
			await recoverDockerWorkspace(daemon, task.storage, task.cwd);
		}
	} finally {
		await removeContainers(daemon, [id]);
	}
}

function dockerUser(): string {
	const uid = process.getuid?.();
	const gid = process.getgid?.();
	if (!uid || gid === undefined)
		throw new ModuleTaskRunError('The Linux Docker pilot requires a non-root Unix user.');
	return `${uid}:${gid}`;
}
