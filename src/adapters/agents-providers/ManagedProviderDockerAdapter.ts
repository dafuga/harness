// @harness-uid u_ymrcybx25k
import { spawn } from 'node:child_process';
import type { ChildProcessWithoutNullStreams } from 'node:child_process';
import { realpath } from 'node:fs/promises';
import type {
	DockerTaskCreate,
	DockerTaskDaemon,
	DockerTaskWorkspace
} from './ManagedProviderDockerAdapter.types';
import { ModuleTaskRunError } from './module-task-runner-adapter/ModuleTaskRunError';
import {
	createContainer,
	dockerArgs,
	dockerDaemon,
	removeScopedContainer,
	taskLabel
} from './managed-provider-docker-adapter/dockerContainerScope';
import {
	newLaunch,
	launchDirectory,
	recoverLaunches,
	forgetLaunch,
	writeLaunch
} from './managed-provider-docker-adapter/dockerLaunchJournal';

export const managedProviderDockerResources = { cpus: 2, memoryMiB: 6144 };

/** Run a local, offline Linux fixture with one task-owned container. */
export class ManagedProviderDockerAdapter {
	command([executable, ...args]: string[], task: DockerTaskCreate): string[] {
		const { cpus, memoryMiB } = managedProviderDockerResources;
		const source = `"source=${task.cwd.replaceAll('"', '""')}"`;
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
			`--mount=type=bind,${source},target=/workspace,bind-recursive=disabled`,
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
		workspace.signal.throwIfAborted();
		const launch = newLaunch(daemon, cwd);
		await writeLaunch(directory, launch);
		if (workspace.signal.aborted) {
			await forgetLaunch(directory, launch);
			workspace.signal.throwIfAborted();
		}
		try {
			const owner = launch.owner;
			const id = await createContainer(
				daemon,
				this.command(command, { ...workspace, cwd, owner, user })
			);
			launch.containerId = id;
			await writeLaunch(directory, launch);
			workspace.signal.throwIfAborted();
			return await collect(attachContainer(daemon, id));
		} finally {
			if (await removeScopedContainer(daemon, launch)) await forgetLaunch(directory, launch);
		}
	}
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
