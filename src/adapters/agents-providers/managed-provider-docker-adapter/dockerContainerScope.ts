// @harness-uid u_ymrcybx25k
import { basename } from 'node:path';
import { z } from 'zod';
import type {
	DockerBindLaunch,
	DockerTaskDaemon,
	DockerTaskLaunch,
	DockerVolumeLaunch,
	DockerVolumeResources
} from '../ManagedProviderDockerAdapter.types';
import { ModuleTaskRunError } from '../module-task-runner-adapter/ModuleTaskRunError';
import {
	containerIdPattern,
	dockerControl,
	ownedVolumeExists,
	removeVolume,
	requireDaemon,
	storageLabel,
	taskLabel
} from './dockerControl';
import { storagePath, workspaceVolume } from './dockerWorkspace';

const mount = z.object({
	Type: z.string(),
	Source: z.string(),
	Destination: z.string(),
	Name: z.string().optional()
});
const configuredMount = z.object({
	Type: z.literal('volume'),
	Source: z.string(),
	Target: z.string(),
	VolumeOptions: z.object({ NoCopy: z.literal(true), Subpath: z.string().optional() })
});
const labels = z.record(z.string(), z.string()).nullable();

export async function removeLaunch(
	daemon: DockerTaskDaemon,
	launch: DockerTaskLaunch
): Promise<boolean> {
	if (launch.version === 1) return removeScopedContainer(daemon, launch);
	return removeVolumeLaunch(daemon, launch);
}

async function removeVolumeLaunch(
	daemon: DockerTaskDaemon,
	launch: DockerVolumeLaunch
): Promise<boolean> {
	await requireDaemon(daemon);
	const volume = await ownedVolumeExists(daemon, launch.owner);
	const storage = await scopedContainer(daemon, launch, storageLabel);
	const task = await scopedContainer(daemon, launch, taskLabel);
	const resources = { volume, storage, task };
	requireResourceOrder(launch.stage, resources);
	if (!createObserved(launch, resources)) return false;
	if (task) await removeById(daemon, launch, task, taskLabel);
	if (storage) await removeById(daemon, launch, storage, storageLabel);
	await removeVolume(daemon, launch.owner);
	return true;
}

function requireResourceOrder(
	stage: DockerVolumeLaunch['stage'],
	{ volume, storage, task }: DockerVolumeResources
): void {
	if ((storage || task) && (!volume || stage === 'volume'))
		throw new ModuleTaskRunError('Inconsistent Docker volume launch scope. Recovery receipt kept.');
	if (task && stage === 'storage')
		throw new ModuleTaskRunError('Unexpected Docker task container. Recovery receipt kept.');
}

/** An unconfirmed create can outlive its CLI and still need its prerequisite volume. */
function createObserved(
	launch: DockerVolumeLaunch,
	{ volume, storage, task }: DockerVolumeResources
): boolean {
	if (launch.stage === 'volume') return volume;
	if (launch.stage === 'storage') return Boolean(storage ?? launch.storageId);
	return Boolean(task ?? launch.containerId);
}

/** Returns false if the create may still finish and the receipt must be kept. */
export async function removeScopedContainer(
	daemon: DockerTaskDaemon,
	launch: DockerTaskLaunch
): Promise<boolean> {
	await requireDaemon(daemon);
	const id = await scopedContainer(daemon, launch, taskLabel);
	if (!id) return launch.containerId !== undefined;
	await removeById(daemon, launch, id, taskLabel);
	return true;
}

async function scopedContainer(
	daemon: DockerTaskDaemon,
	launch: DockerTaskLaunch,
	label: string
): Promise<string | undefined> {
	const ids = await ownerContainers(daemon, launch.owner, label);
	if (!ids.length) return undefined;
	const [id] = ids;
	const known =
		label === storageLabel && launch.version === 2 ? launch.storageId : launch.containerId;
	if (ids.length !== 1 || (known && id !== known))
		throw new ModuleTaskRunError(
			'Ambiguous Docker task container identity. Recovery receipt kept.'
		);
	const format =
		'{{json .Id}}\n{{json .Config.Labels}}\n{{json .Mounts}}\n{{json .HostConfig.Mounts}}';
	const output = await dockerControl(daemon, [
		'container',
		'inspect',
		'--format',
		format,
		id
	]).catch(() => undefined);
	if (output === undefined) {
		await confirmGone(daemon, launch.owner, label);
		return undefined;
	}
	if (!scopeMatches(output, launch, id, label))
		throw new ModuleTaskRunError(
			'Docker task owner label or workspace mismatch. Recovery receipt kept.'
		);
	return id;
}

function scopeMatches(
	output: string,
	launch: DockerTaskLaunch,
	id: string,
	label: string
): boolean {
	const [inspectedId, rawLabels, rawMounts, rawConfiguration] = output
		.split('\n')
		.map((field) => JSON.parse(field));
	const tagged = labels.safeParse(rawLabels);
	const mounts = z.array(mount).safeParse(rawMounts);
	if (
		inspectedId !== id ||
		!tagged.success ||
		tagged.data?.[label] !== launch.owner ||
		!mounts.success
	)
		return false;
	if (launch.version === 1) return bindMatches(mounts.data, launch);
	return volumeMatches(mounts.data, rawConfiguration, launch, label);
}

function bindMatches(mounts: z.infer<typeof mount>[], launch: DockerBindLaunch): boolean {
	const binds = mounts.filter((entry) => entry.Type === 'bind');
	if (binds.length !== 1 || binds[0].Destination !== '/workspace') return false;
	const source = binds[0].Source;
	return (
		source === launch.cwd || (process.platform === 'darwin' && source === '/host_mnt' + launch.cwd)
	);
}

function volumeMatches(
	mounts: z.infer<typeof mount>[],
	configuration: unknown,
	launch: DockerVolumeLaunch,
	label: string
): boolean {
	const name = workspaceVolume(launch.owner);
	const destination = label === storageLabel ? storagePath : '/workspace';
	const subpath = label === storageLabel ? undefined : basename(launch.cwd);
	if (mounts.length !== 1) return false;
	const [mounted] = mounts;
	if (mounted.Type !== 'volume' || mounted.Name !== name || mounted.Destination !== destination)
		return false;
	const configured = z.tuple([configuredMount]).safeParse(configuration);
	if (!configured.success) return false;
	const [entry] = configured.data;
	return (
		entry.Source === name && entry.Target === destination && entry.VolumeOptions.Subpath === subpath
	);
}

async function removeById(
	daemon: DockerTaskDaemon,
	launch: DockerTaskLaunch,
	id: string,
	label: string
): Promise<void> {
	await requireDaemon(daemon);
	const flags = launch.version === 1 ? ['--volumes'] : [];
	try {
		await dockerControl(daemon, ['rm', '--force', ...flags, id]);
	} catch {
		await confirmGone(daemon, launch.owner, label);
	}
}

async function confirmGone(daemon: DockerTaskDaemon, owner: string, label: string): Promise<void> {
	await requireDaemon(daemon);
	if ((await ownerContainers(daemon, owner, label)).length)
		throw new ModuleTaskRunError('Could not confirm Docker task removal. Recovery receipt kept.');
}

async function ownerContainers(
	daemon: DockerTaskDaemon,
	owner: string,
	label: string
): Promise<string[]> {
	const args = ['ps', '--all', '--quiet', '--no-trunc', '--filter', `label=${label}=${owner}`];
	const output = await dockerControl(daemon, args).catch(() => {
		throw new ModuleTaskRunError('Could not list Docker task containers. Recovery receipt kept.');
	});
	const ids = output ? output.split('\n') : [];
	if (ids.some((id) => !containerIdPattern.test(id)))
		throw new ModuleTaskRunError('Invalid Docker task list. Recovery receipt kept.');
	return ids;
}
