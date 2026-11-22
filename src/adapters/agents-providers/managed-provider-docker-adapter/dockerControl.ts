// @harness-uid u_ymrcybx25k
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { z } from 'zod';
import type { DockerTaskCreate, DockerTaskDaemon } from '../ManagedProviderDockerAdapter.types';
import { ModuleTaskRunError } from '../module-task-runner-adapter/ModuleTaskRunError';
import { storagePath, workspaceVolume } from './dockerWorkspace';

const docker = promisify(execFile);
export const containerIdPattern = /^[a-f0-9]{64}$/;
export const dockerSocketPattern = /^unix:\/\/\/[^\r\n]+$/;
export const daemonIdPattern = /^[a-z0-9:-]{12,128}$/i;
export const taskLabel = 'org.harness.managed-provider-task';
export const storageLabel = 'org.harness.managed-provider-storage';
const volumeSchema = z.object({
	Name: z.string(),
	Driver: z.literal('local'),
	Scope: z.literal('local'),
	Options: z.record(z.string(), z.string()).nullable(),
	Labels: z.record(z.string(), z.string())
});

export async function dockerDaemon(context?: string): Promise<DockerTaskDaemon> {
	const env = { PATH: process.env.PATH, HOME: process.env.HOME };
	const args = ['context', 'inspect', '--format', '{{.Endpoints.docker.Host}}'];
	if (context) args.push('--', context);
	const host = await control(args, env).catch(() => '');
	if (!dockerSocketPattern.test(host))
		throw new ModuleTaskRunError('The Linux Docker pilot requires a local Unix socket context.');
	const endpoint = { env, host };
	return { ...endpoint, id: await serverId(endpoint) };
}

export async function requireWorkspaceImage(
	daemon: DockerTaskDaemon,
	image: string
): Promise<void> {
	const format = '{{.Os}}\n{{json .Config.Volumes}}';
	const output = await dockerControl(daemon, ['image', 'inspect', '--format', format, image]).catch(
		() => ''
	);
	if (output === 'linux\nnull' || output === 'linux\n{}') return;
	throw new ModuleTaskRunError(
		'Use a locally installed Linux fixture image without image volumes.'
	);
}

export function createStorageContainer(
	daemon: DockerTaskDaemon,
	task: DockerTaskCreate
): Promise<string> {
	return createContainer(daemon, [
		'create',
		'--pull=never',
		'--network=none',
		'--read-only',
		'--cap-drop=ALL',
		'--security-opt=no-new-privileges',
		`--user=${task.user}`,
		`--label=${storageLabel}=${task.owner}`,
		`--mount=type=volume,source=${workspaceVolume(task.owner)},target=${storagePath},volume-nocopy`,
		'--entrypoint=/bin/false',
		task.image
	]);
}

export async function createContainer(daemon: DockerTaskDaemon, args: string[]): Promise<string> {
	await requireDaemon(daemon);
	const id = await dockerControl(daemon, args).catch(() => '');
	if (containerIdPattern.test(id)) return id;
	throw new ModuleTaskRunError(
		'Could not create the Docker task container. Check the local image and Docker volume support.'
	);
}

export async function createVolume(daemon: DockerTaskDaemon, owner: string): Promise<void> {
	await requireDaemon(daemon);
	const name = workspaceVolume(owner);
	const label = `${storageLabel}=${owner}`;
	const args = ['volume', 'create', '--driver=local', `--label=${label}`, name];
	const created = await dockerControl(daemon, args).catch(() => '');
	if (created === name && (await ownedVolumeExists(daemon, owner))) return;
	throw new ModuleTaskRunError('Could not create the task-owned Docker volume.');
}

export async function ownedVolumeExists(daemon: DockerTaskDaemon, owner: string): Promise<boolean> {
	const name = workspaceVolume(owner);
	const listed = await dockerControl(daemon, ['volume', 'ls', '-q', '--filter', 'name=' + name]);
	if (!listed.split('\n').includes(name)) return false;
	const output = await dockerControl(daemon, [
		'volume',
		'inspect',
		'--format',
		'{{json .}}',
		name
	]).catch(() => undefined);
	if (output === undefined) {
		const remaining = await dockerControl(daemon, [
			'volume',
			'ls',
			'-q',
			'--filter',
			'name=' + name
		]);
		if (!remaining.split('\n').includes(name)) return false;
		throw new ModuleTaskRunError('Could not inspect Docker task volume. Recovery receipt kept.');
	}
	const parsed = volumeSchema.safeParse(JSON.parse(output));
	if (parsed.success && matchingVolume(parsed.data, name, owner)) return true;
	throw new ModuleTaskRunError('Docker task volume scope mismatch. Recovery receipt kept.');
}

function matchingVolume(
	volume: z.infer<typeof volumeSchema>,
	name: string,
	owner: string
): boolean {
	return (
		volume.Name === name &&
		volume.Labels[storageLabel] === owner &&
		Object.keys(volume.Options ?? {}).length === 0
	);
}

export async function removeVolume(daemon: DockerTaskDaemon, owner: string): Promise<void> {
	await requireDaemon(daemon);
	if (!(await ownedVolumeExists(daemon, owner))) return;
	try {
		await dockerControl(daemon, ['volume', 'rm', workspaceVolume(owner)]);
	} catch {
		await requireDaemon(daemon);
		if (await ownedVolumeExists(daemon, owner))
			throw new ModuleTaskRunError('Could not remove Docker task volume. Recovery receipt kept.');
	}
}

async function serverId(daemon: Pick<DockerTaskDaemon, 'host' | 'env'>): Promise<string> {
	const id = await dockerControl(daemon, ['info', '--format', '{{.ID}}']).catch(() => '');
	if (!daemonIdPattern.test(id))
		throw new ModuleTaskRunError('Could not establish the local Docker engine identity.');
	return id;
}

export async function requireDaemon(daemon: DockerTaskDaemon): Promise<void> {
	if ((await serverId(daemon)) !== daemon.id)
		throw new ModuleTaskRunError('The local Docker engine changed. Recovery receipt kept.');
}

export function dockerArgs(daemon: Pick<DockerTaskDaemon, 'host'>, args: string[]): string[] {
	return ['--host', daemon.host, ...args];
}

export function dockerControl(
	daemon: Pick<DockerTaskDaemon, 'host' | 'env'>,
	args: string[]
): Promise<string> {
	return control(dockerArgs(daemon, args), daemon.env);
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
