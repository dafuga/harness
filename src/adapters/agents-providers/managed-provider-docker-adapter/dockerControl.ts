// @harness-uid u_ymrcybx25k
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { DockerTaskCreate, DockerTaskDaemon } from '../ManagedProviderDockerAdapter.types';
import { ModuleTaskRunError } from '../module-task-runner-adapter/ModuleTaskRunError';
import { storagePath, workspaceVolume } from './dockerWorkspace';

const docker = promisify(execFile);
const idPattern = /^[a-f0-9]{64}$/;
const storageLabel = 'org.harness.managed-provider-storage';

export function createStorageContainer(
	daemon: DockerTaskDaemon,
	task: DockerTaskCreate
): Promise<string> {
	const label = `${storageLabel}=${task.owner}`;
	// Docker creates the destination for cp; this container is never started.
	return createContainer(
		daemon,
		[
			'create',
			'--pull=never',
			'--network=none',
			'--read-only',
			'--cap-drop=ALL',
			'--security-opt=no-new-privileges',
			`--user=${task.user}`,
			`--label=${label}`,
			`--mount=type=volume,source=${workspaceVolume(task.owner)},target=${storagePath},volume-nocopy`,
			'--entrypoint=/bin/false',
			task.image
		],
		label
	);
}

export async function createVolume(daemon: DockerTaskDaemon, owner: string): Promise<void> {
	const name = workspaceVolume(owner);
	const label = `${storageLabel}=${owner}`;
	const args = ['volume', 'create', '--driver=local', `--label=${label}`, name];
	const created = await control(dockerArgs(daemon, args), daemon.env).catch(() => '');
	if (created === name) return;
	const existing = await control(
		dockerArgs(daemon, ['volume', 'ls', '-q', `--filter=label=${label}`]),
		daemon.env
	);
	if (existing.split('\n').includes(name)) await removeVolume(daemon, owner);
	throw new ModuleTaskRunError('Could not create the task-owned Docker volume.');
}

export async function removeVolume(daemon: DockerTaskDaemon, owner: string): Promise<void> {
	const name = workspaceVolume(owner);
	await control(dockerArgs(daemon, ['volume', 'rm', name]), daemon.env).catch(() => {
		throw new ModuleTaskRunError(`Could not remove Docker task volume ${name}.`);
	});
}

export async function dockerDaemon(): Promise<DockerTaskDaemon> {
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

export async function createContainer(
	daemon: DockerTaskDaemon,
	args: string[],
	label: string
): Promise<string> {
	const id = await control(dockerArgs(daemon, args), daemon.env).catch(() => '');
	if (idPattern.test(id)) return id;
	// The daemon may have created the container before the CLI failed or timed out.
	await removeUnconfirmedContainer(daemon, label);
	throw new ModuleTaskRunError(
		'Could not create the Docker task container. Check the local image and Docker volume support.'
	);
}

async function removeUnconfirmedContainer(daemon: DockerTaskDaemon, label: string): Promise<void> {
	const args = ['ps', '--all', '--quiet', '--no-trunc', '--filter', `label=${label}`];
	const ids = await control(dockerArgs(daemon, args), daemon.env).catch(() => {
		throw new ModuleTaskRunError(`Could not confirm Docker cleanup for task label ${label}.`);
	});
	if (!ids) return;
	await removeContainers(
		daemon,
		ids.split('\n').filter((id) => idPattern.test(id))
	);
}

export async function removeContainers(daemon: DockerTaskDaemon, ids: string[]): Promise<void> {
	if (!ids.length) return;
	try {
		await control(dockerArgs(daemon, ['rm', '--force', '--volumes', ...ids]), daemon.env);
	} catch {
		throw new ModuleTaskRunError(`Could not remove Docker task container(s) ${ids.join(', ')}.`);
	}
}

export function dockerArgs(daemon: DockerTaskDaemon, args: string[]) {
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

export async function stopContainer(daemon: DockerTaskDaemon, id: string): Promise<void> {
	await control(dockerArgs(daemon, ['stop', '--time=0', id]), daemon.env).catch(() => {
		throw new ModuleTaskRunError(`Could not stop Docker task container ${id}.`);
	});
}
