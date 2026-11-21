// @harness-uid u_ymrcybx25k
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { z } from 'zod';
import type { DockerTaskDaemon, DockerTaskLaunch } from '../ManagedProviderDockerAdapter.types';
import { ModuleTaskRunError } from '../module-task-runner-adapter/ModuleTaskRunError';

const docker = promisify(execFile);
export const containerIdPattern = /^[a-f0-9]{64}$/;
export const dockerSocketPattern = /^unix:\/\/\/[^\r\n]+$/;
export const daemonIdPattern = /^[a-z0-9:-]{12,128}$/i;
export const taskLabel = 'org.harness.managed-provider-task';

const mounts = z.array(z.object({ Type: z.string(), Source: z.string(), Destination: z.string() }));

export async function dockerDaemon(): Promise<DockerTaskDaemon> {
	const env = { PATH: process.env.PATH, HOME: process.env.HOME };
	const args = ['context', 'inspect', '--format', '{{.Endpoints.docker.Host}}'];
	const host = await control(args, env).catch(() => '');
	if (!dockerSocketPattern.test(host))
		throw new ModuleTaskRunError('The Linux Docker pilot requires a local Unix socket context.');
	const endpoint = { env, host };
	return { ...endpoint, id: await serverId(endpoint) };
}

export async function createContainer(daemon: DockerTaskDaemon, args: string[]): Promise<string> {
	await requireDaemon(daemon);
	const id = await dockerControl(daemon, args).catch(() => '');
	if (containerIdPattern.test(id)) return id;
	throw new ModuleTaskRunError(
		'Could not create the Docker task container. Check the local image and workspace mount.'
	);
}

/** Returns false when a create may still arrive and its receipt must be kept. */
export async function removeScopedContainer(
	daemon: DockerTaskDaemon,
	launch: DockerTaskLaunch
): Promise<boolean> {
	await requireDaemon(daemon);
	const ids = await ownerContainers(daemon, launch.owner);
	if (!ids.length) return launch.containerId !== undefined;
	const [id] = ids;
	if (ids.length !== 1 || (launch.containerId && id !== launch.containerId))
		throw new ModuleTaskRunError(
			'Ambiguous Docker task container identity. Recovery receipt kept.'
		);
	const format = '{{json .Id}}\n{{json .Config.Labels}}\n{{json .Mounts}}';
	const inspected = await dockerControl(daemon, [
		'container',
		'inspect',
		'--format',
		format,
		id
	]).catch(() => undefined);
	if (inspected === undefined) return confirmGone(daemon, launch);
	if (!scopeMatches(inspected, id, launch))
		throw new ModuleTaskRunError(
			'Docker task owner label or workspace mismatch. Recovery receipt kept.'
		);
	await requireDaemon(daemon);
	try {
		await dockerControl(daemon, ['rm', '--force', '--volumes', id]);
		return true;
	} catch {
		return confirmGone(daemon, launch);
	}
}

async function confirmGone(daemon: DockerTaskDaemon, launch: DockerTaskLaunch): Promise<boolean> {
	await requireDaemon(daemon);
	if ((await ownerContainers(daemon, launch.owner)).length)
		throw new ModuleTaskRunError('Could not confirm Docker task removal. Recovery receipt kept.');
	// This owner had exactly one observed container and Docker create is never retried.
	return true;
}

function scopeMatches(output: string, id: string, launch: DockerTaskLaunch): boolean {
	const [inspectedId, labels, rawMounts] = output.split('\n').map((field) => JSON.parse(field));
	if (inspectedId !== id || labels?.[taskLabel] !== launch.owner) return false;
	const inspected = mounts.safeParse(rawMounts);
	if (!inspected.success) return false;
	const binds = inspected.data.filter((mount) => mount.Type === 'bind');
	if (binds.length !== 1 || binds[0].Destination !== '/workspace') return false;
	const source = binds[0].Source;
	return (
		source === launch.cwd || (process.platform === 'darwin' && source === '/host_mnt' + launch.cwd)
	);
}

async function ownerContainers(daemon: DockerTaskDaemon, owner: string): Promise<string[]> {
	const args = [
		'ps',
		'--all',
		'--quiet',
		'--no-trunc',
		'--filter',
		'label=' + taskLabel + '=' + owner
	];
	const output = await dockerControl(daemon, args).catch(() => {
		throw new ModuleTaskRunError('Could not list Docker task containers. Recovery receipt kept.');
	});
	const ids = output ? output.split('\n') : [];
	if (ids.some((id) => !containerIdPattern.test(id)))
		throw new ModuleTaskRunError('Invalid Docker task list. Recovery receipt kept.');
	return ids;
}

async function serverId(daemon: Pick<DockerTaskDaemon, 'host' | 'env'>): Promise<string> {
	const id = await dockerControl(daemon, ['info', '--format', '{{.ID}}']).catch(() => '');
	if (!daemonIdPattern.test(id))
		throw new ModuleTaskRunError('Could not establish the local Docker engine identity.');
	return id;
}

async function requireDaemon(daemon: DockerTaskDaemon): Promise<void> {
	if ((await serverId(daemon)) !== daemon.id)
		throw new ModuleTaskRunError('The local Docker engine changed. Recovery receipt kept.');
}

export function dockerArgs(daemon: Pick<DockerTaskDaemon, 'host'>, args: string[]) {
	return ['--host', daemon.host, ...args];
}

function dockerControl(daemon: Pick<DockerTaskDaemon, 'host' | 'env'>, args: string[]) {
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
