// @harness-uid u_ymrcybx25k
import { execFile, spawn } from 'node:child_process';
import type { ChildProcessWithoutNullStreams } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { realpath } from 'node:fs/promises';
import { promisify } from 'node:util';
import type {
	DockerTaskCreate,
	DockerTaskDaemon,
	DockerTaskWorkspace
} from './ManagedProviderDockerAdapter.types';
import { ModuleTaskRunError } from './module-task-runner-adapter/ModuleTaskRunError';

const docker = promisify(execFile);
const idPattern = /^[a-f0-9]{64}$/;
const taskLabel = 'org.harness.managed-provider-task';
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
		workspace.signal.throwIfAborted();
		const owner = randomUUID();
		const id = await createContainer(
			daemon,
			this.command(command, { ...workspace, cwd, owner, user }),
			owner
		);
		try {
			workspace.signal.throwIfAborted();
			const child = spawn(
				'docker',
				dockerArgs(daemon, ['start', '--attach', '--interactive', id]),
				{
					env: daemon.env,
					stdio: 'pipe',
					detached: true
				}
			);
			return await collect(child);
		} finally {
			await removeContainers(daemon, [id]);
		}
	}
}

function dockerUser(): string {
	const uid = process.getuid?.();
	const gid = process.getgid?.();
	if (!uid || gid === undefined)
		throw new ModuleTaskRunError('The Linux Docker pilot requires a non-root Unix user.');
	return `${uid}:${gid}`;
}

async function dockerDaemon(): Promise<DockerTaskDaemon> {
	const env = { PATH: process.env.PATH, HOME: process.env.HOME };
	const args = ['context', 'inspect', '--format', '{{.Endpoints.docker.Host}}'];
	const host = await control(args, env).catch(() => {
		throw new ModuleTaskRunError(
			'The Linux task requires Docker CLI and a local Unix socket context.'
		);
	});
	if (!/^unix:\/\/\/[^\r\n]+$/.test(host))
		throw new ModuleTaskRunError('The Linux Docker pilot requires a local Unix socket context.');
	return { env, host };
}

async function createContainer(
	daemon: DockerTaskDaemon,
	args: string[],
	owner: string
): Promise<string> {
	const id = await control(dockerArgs(daemon, args), daemon.env).catch(() => '');
	if (idPattern.test(id)) return id;
	// The daemon may have created the container before the CLI failed or timed out.
	await removeUnconfirmedContainer(daemon, owner);
	throw new ModuleTaskRunError(
		'Could not create the Docker task container. Check the local image and workspace mount.'
	);
}

async function removeUnconfirmedContainer(daemon: DockerTaskDaemon, owner: string): Promise<void> {
	const args = ['ps', '--all', '--quiet', '--no-trunc', '--filter', `label=${taskLabel}=${owner}`];
	const ids = await control(dockerArgs(daemon, args), daemon.env).catch(() => {
		throw new ModuleTaskRunError(
			`Could not confirm Docker cleanup for task label ${taskLabel}=${owner}.`
		);
	});
	if (!ids) return;
	await removeContainers(
		daemon,
		ids.split('\n').filter((id) => idPattern.test(id))
	);
}

async function removeContainers(daemon: DockerTaskDaemon, ids: string[]): Promise<void> {
	if (!ids.length) return;
	try {
		await control(dockerArgs(daemon, ['rm', '--force', '--volumes', ...ids]), daemon.env);
	} catch {
		throw new ModuleTaskRunError(`Could not remove Docker task container(s) ${ids.join(', ')}.`);
	}
}

function dockerArgs(daemon: DockerTaskDaemon, args: string[]) {
	return ['--host', daemon.host, ...args];
}

async function control(args: string[], env: DockerTaskDaemon['env']): Promise<string> {
	const { stdout } = await docker('docker', args, {
		env,
		timeout: 15000,
		killSignal: 'SIGKILL',
		maxBuffer: 65536
	});
	return stdout.trim();
}
