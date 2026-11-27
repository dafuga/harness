// @harness-uid u_ymrcybx25k
import { execFile } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import {
	lstat,
	mkdir,
	open,
	readdir,
	readFile,
	readlink,
	realpath,
	rename,
	rm
} from 'node:fs/promises';
import { isAbsolute, join, relative, sep } from 'node:path';
import { promisify } from 'node:util';
import { z } from 'zod';
import { ProcessIdentityAdapter } from '../../../services/agents-providers/agent-activity-service/ProcessIdentityAdapter';
import { resourceHome } from '../../../utils/execution-runtimes/resourceConfig';
import type {
	DockerTaskDaemon,
	DockerTaskLaunch,
	DockerVolumeLaunch
} from '../ManagedProviderDockerAdapter.types';
import { ModuleTaskRunError } from '../module-task-runner-adapter/ModuleTaskRunError';
import { containerIdPattern, daemonIdPattern, dockerSocketPattern } from './dockerControl';
import { removeLaunch } from './dockerContainerScope';

const ownerPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const identity = {
	owner: z.string().regex(ownerPattern),
	cwd: z.string().max(4096).refine(isAbsolute),
	host: z.string().regex(dockerSocketPattern),
	daemonId: z.string().regex(daemonIdPattern),
	pid: z.number().int().positive().max(2147483647),
	startedAt: z.string().min(1).max(128),
	containerId: z.string().regex(containerIdPattern).optional()
};
const launchSchema = z.discriminatedUnion('version', [
	z.strictObject({ ...identity, version: z.literal(1) }),
	z
		.strictObject({
			...identity,
			version: z.literal(2),
			stage: z.enum(['volume', 'storage', 'task']),
			storageId: z.string().regex(containerIdPattern).optional()
		})
		.refine(({ stage, storageId, containerId }) => {
			if (stage === 'task') return storageId !== undefined;
			return containerId === undefined && (stage === 'storage' || storageId === undefined);
		})
]);

export async function launchDirectory(cwd: string): Promise<string> {
	const scope = await localSupervisorScope();
	const tracker = process.env.HARNESS_TRACKER_HYGIENE;
	const path = tracker
		? join(tracker, 'provider-docker', scope)
		: join(resourceHome(), 'managed-docker-launches', scope);
	await mkdir(path, { mode: 0o700, recursive: true });
	const metadata = await lstat(path);
	if (!metadata.isDirectory() || metadata.uid !== process.getuid?.() || metadata.mode & 0o077)
		throw new ModuleTaskRunError('The Docker launch journal requires a private host directory.');
	const directory = await realpath(path);
	const fromWorkspace = relative(cwd, directory);
	if (!fromWorkspace || (!isAbsolute(fromWorkspace) && !fromWorkspace.startsWith('..' + sep)))
		throw new ModuleTaskRunError('The Docker task workspace would expose the host launch journal.');
	return directory;
}

async function localSupervisorScope(): Promise<string> {
	const machine = await machineIdentity().catch(() => '');
	if (!machine) throw new ModuleTaskRunError('Cannot establish the Docker pilot host identity.');
	return createHash('sha256').update(process.platform).update(':').update(machine).digest('hex');
}

async function machineIdentity(): Promise<string> {
	if (process.platform === 'linux') {
		const machine = (await readFile('/etc/machine-id', 'utf8')).trim();
		if (!/^[a-f0-9]{32}$/.test(machine)) return '';
		return machine + ':' + (await readlink('/proc/self/ns/pid'));
	}
	if (process.platform !== 'darwin') return '';
	const { stdout } = await promisify(execFile)(
		'/usr/sbin/ioreg',
		['-rd1', '-c', 'IOPlatformExpertDevice', '-k', 'IOPlatformUUID'],
		{ timeout: 3000, maxBuffer: 65536 }
	);
	return stdout.match(/"IOPlatformUUID" = "([a-f0-9-]{36})"/i)?.[1] ?? '';
}

export function newLaunch(daemon: DockerTaskDaemon, cwd: string): DockerVolumeLaunch {
	const identity = new ProcessIdentityAdapter().find(process.pid);
	if (!identity.startedAt)
		throw new ModuleTaskRunError('Cannot establish Docker supervisor identity.');
	return {
		version: 2,
		stage: 'volume',
		owner: randomUUID(),
		cwd,
		host: daemon.host,
		daemonId: daemon.id,
		pid: process.pid,
		startedAt: identity.startedAt
	};
}

export async function writeLaunch(directory: string, launch: DockerTaskLaunch): Promise<void> {
	const temporary = join(directory, launch.owner + '.partial');
	const handle = await open(temporary, 'wx', 0o600);
	try {
		try {
			await handle.writeFile(JSON.stringify(launch));
			await handle.sync();
		} finally {
			await handle.close();
		}
		await rename(temporary, receiptPath(directory, launch.owner));
		const parent = await open(directory, 'r');
		try {
			await parent.sync();
		} finally {
			await parent.close();
		}
	} finally {
		await rm(temporary, { force: true });
	}
}

export async function forgetLaunch(directory: string, launch: DockerTaskLaunch): Promise<void> {
	await rm(receiptPath(directory, launch.owner), { force: true });
}

/** Only an explicit managed launch sweeps its own host state and current Docker engine. */
export async function recoverLaunches(
	directory: string,
	daemon: DockerTaskDaemon,
	signal: AbortSignal
): Promise<void> {
	for (const file of await readdir(directory, { withFileTypes: true })) {
		signal.throwIfAborted();
		const owner = file.name.slice(0, -5);
		if (!file.isFile() || !file.name.endsWith('.json') || !ownerPattern.test(owner)) continue;
		const launch = await readLaunch(directory, owner);
		if (launch?.host !== daemon.host || launch.daemonId !== daemon.id) continue;
		if (!supervisorGone(launch)) continue;
		if (await removeLaunch(daemon, launch)) await forgetLaunch(directory, launch);
	}
}

async function readLaunch(directory: string, owner: string): Promise<DockerTaskLaunch | undefined> {
	try {
		const raw = await readFile(receiptPath(directory, owner), 'utf8');
		const parsed = launchSchema.safeParse(JSON.parse(raw));
		if (parsed.success && parsed.data.owner === owner) return parsed.data;
	} catch (error) {
		if (!(error instanceof SyntaxError) && (error as { code?: string }).code !== 'ENOENT')
			throw error;
	}
	return undefined;
}

function receiptPath(directory: string, owner: string): string {
	return join(directory, owner + '.json');
}

function supervisorGone(launch: DockerTaskLaunch): boolean {
	const identity = new ProcessIdentityAdapter().find(launch.pid);
	if (identity.exists === true && identity.startedAt)
		return identity.startedAt !== launch.startedAt;
	if (identity.exists !== false) return false;
	// A process hidden from ps is still alive. Require an explicit no-such-process result.
	try {
		process.kill(launch.pid, 0);
		return false;
	} catch (error) {
		return (error as { code?: string }).code === 'ESRCH';
	}
}
