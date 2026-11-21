// @harness-uid u_f77zx26wcb
import { ExpectedCliError } from '../../core/development-tooling/errors';
import { randomUUID } from 'node:crypto';
import { runProcess } from '../../core/execution-runtimes/scripted-deploy/runProcess';
import { scriptFile } from '../../validators/execution-runtimes/DeployManifestValidator';
import type { DeployDockerAdapterConfig, LocalPhase } from './DeployDockerAdapter.types';

export class DeployDockerAdapter {
	constructor(private readonly config: DeployDockerAdapterConfig) {}

	async run(phase: LocalPhase, mounts: Record<string, string>, input: object): Promise<unknown> {
		const container = 'harness-deploy-' + randomUUID();
		const { project } = this.config;
		const script = scriptFile(project.root, project.scripts[phase]);
		const argv = containerArguments({ container, phase, mounts, script }, this.config);
		const controller = new AbortController();
		const interrupt = () => controller.abort();
		process.once('SIGINT', interrupt);
		process.once('SIGTERM', interrupt);
		try {
			const output = await runProcess('docker', argv, {
				stdin: input,
				signal: controller.signal,
				timeout: phase === 'build' ? 900_000 : 60_000,
				description: 'Docker ' + phase
			});
			return JSON.parse(output) as unknown;
		} finally {
			process.off('SIGINT', interrupt);
			process.off('SIGTERM', interrupt);
			await removeContainer(container);
		}
	}
}

function containerArguments(
	input: { container: string; phase: LocalPhase; mounts: Record<string, string>; script: string },
	{ project }: DeployDockerAdapterConfig
): string[] {
	const { container, phase, mounts, script } = input;
	const isolation = [
		'--rm',
		'-i',
		'--init',
		'--pull=never',
		'--name',
		container,
		'--label',
		'org.harness.deploy=' + container,
		'--read-only',
		'--tmpfs',
		'/tmp:rw,exec,nosuid,nodev,size=3g,mode=1777',
		'--cap-drop=ALL',
		'--security-opt=no-new-privileges',
		'--log-driver=none',
		'--memory=4g',
		'--cpus=2',
		'--pids-limit=384',
		'--user',
		nonroot(process.getuid?.()) + ':' + nonroot(process.getgid?.()),
		'--network',
		phase === 'cleanup' ? 'none' : 'bridge',
		'--env',
		'HOME=/tmp',
		'--env',
		'CI=1',
		'--env',
		'WRANGLER_LOG=none'
	];
	const bind = [
		mount(script, '/deploy-phase', false),
		...Object.entries(mounts).map(([destination, source]) =>
			mount(source, destination, destination === '/out')
		)
	];
	return [
		'run',
		...isolation,
		...bind.flatMap((value) => ['--mount', value]),
		'--entrypoint',
		'/bin/bash',
		project.image,
		'/deploy-phase'
	];
}

function mount(source: string, destination: string, writable: boolean): string {
	if (!source.startsWith('/') || /[\r\n,]/.test(source) || !/^\/[a-z/-]+$/.test(destination)) {
		throw new ExpectedCliError('Invalid Docker deployment mount.');
	}
	return 'type=bind,src=' + source + ',dst=' + destination + (writable ? '' : ',readonly');
}

async function removeContainer(container: string): Promise<void> {
	const listing = await runProcess(
		'docker',
		['ps', '-aq', '--filter', 'label=org.harness.deploy=' + container],
		{ description: 'Docker cleanup inspection' }
	);
	const id = listing.trim();
	if (!id) return;
	if (!/^[a-f0-9]{12,64}$/.test(id))
		throw new ExpectedCliError('Could not identify the task-owned deployment container.');
	await runProcess('docker', ['rm', '-f', id], { description: 'Docker task container cleanup' });
}

function nonroot(id: number | undefined): number {
	if (id === 0) return 65532;
	return id ?? 65532;
}
