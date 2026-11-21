// @harness-uid u_ymrcybx25k
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { ModuleTaskRunError } from '../module-task-runner-adapter/ModuleTaskRunError';
import { reconcileDockerWorkspace } from './reconcileDockerWorkspace';
import type { DockerTaskDaemon } from '../ManagedProviderDockerAdapter.types';

export const bunCache = '.cache/harness/bun';
export const storagePath = '/storage';
const portableMetadata = ['--no-acls', '--no-xattrs'];
const exclude = ['.git', 'node_modules', bunCache, '.cache/harness/task-worktrees'].map(
	(path) => `--exclude=${path}`
);

export function workspaceVolume(owner: string): string {
	return `harness-task-${owner}`;
}

export function workspaceSubpath(cwd: string): string {
	return `"volume-subpath=${basename(cwd).replaceAll('"', '""')}"`;
}

export async function seedDockerWorkspace(
	daemon: DockerTaskDaemon,
	storage: string,
	cwd: string,
	signal: AbortSignal
): Promise<void> {
	await transfer(
		[
			'tar',
			'--one-file-system',
			...portableMetadata,
			...exclude,
			'-C',
			dirname(cwd),
			'-cf',
			'-',
			'--',
			basename(cwd)
		],
		['docker', '--host', daemon.host, 'cp', '-a', '-', `${storage}:${storagePath}`],
		daemon.env,
		AbortSignal.any([signal, AbortSignal.timeout(120_000)])
	).catch((error: unknown) => {
		signal.throwIfAborted();
		throw new ModuleTaskRunError('Could not stage the worktree in the Docker volume.', {
			cause: error
		});
	});
}

export async function recoverDockerWorkspace(
	daemon: DockerTaskDaemon,
	storage: string,
	cwd: string
): Promise<void> {
	const directory = await mkdtemp(join(tmpdir(), 'harness-docker-workspace-'));
	try {
		await transfer(
			['docker', '--host', daemon.host, 'cp', `${storage}:${storagePath}/${basename(cwd)}/.`, '-'],
			[
				'tar',
				'--no-same-owner',
				'--no-same-permissions',
				...portableMetadata,
				...exclude,
				'-C',
				directory,
				'-xf',
				'-'
			],
			daemon.env,
			AbortSignal.timeout(120_000)
		);
		await reconcileDockerWorkspace(directory, cwd);
	} catch (error) {
		throw new ModuleTaskRunError('Could not restore edits from the Docker workspace.', {
			cause: error
		});
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
}

async function transfer(
	from: string[],
	to: string[],
	environment: DockerTaskDaemon['env'],
	signal: AbortSignal
): Promise<void> {
	signal.throwIfAborted();
	const env = { ...environment, COPYFILE_DISABLE: '1' };
	const source = Bun.spawn(from, { env, signal, stdout: 'pipe', stderr: 'ignore' });
	try {
		const target = Bun.spawn(to, { env, signal, stdin: source.stdout, stderr: 'ignore' });
		const actual = await target.exited;
		if (actual !== 0) throw new ModuleTaskRunError('Workspace archive destination failed.');
		if ((await source.exited) !== 0)
			throw new ModuleTaskRunError('Workspace archive source failed.');
	} finally {
		if (source.exitCode === null) source.kill();
		await source.exited;
	}
}
